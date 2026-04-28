from __future__ import annotations

import base64
from concurrent.futures import Future, ThreadPoolExecutor
from functools import lru_cache
from io import BytesIO
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from fastapi.responses import StreamingResponse

from app.config import get_settings
from app.models import (
    GenerateCoverImageRequest,
    GenerateCoverImageResponse,
    SongGenerateRequest,
    SongListResponse,
    SongRecord,
    SongSessionDetail,
    SongSessionGenerateRequest,
    SongSessionListResponse,
    SongVariantRecord,
    SongVariantSelectionResponse,
)
from app.services.album_video import AlbumVideoError, AlbumVideoService
from app.services.elevenlabs_music import ElevenLabsError, ElevenLabsMusicService
from app.services.openai_images import OpenAIImageError, OpenAIImageService
from app.services.openai_text import (
    OpenAITextError,
    OpenAITextService,
    derive_title_from_lyrics,
)
from app.services.provider_keys import (
    resolve_elevenlabs_api_key,
    resolve_openai_api_key,
)
from app.services.supabase_songs import (
    SongNotFoundError,
    SongSessionNotFoundError,
    SongVariantNotFoundError,
    SupabaseSongsRepository,
)

router = APIRouter(prefix="/songs", tags=["songs"])


def get_music_service(request: Request) -> ElevenLabsMusicService:
    api_key = resolve_elevenlabs_api_key(request)
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "ElevenLabs API key is required for music generation. "
                "Provide it in the x-elevenlabs-api-key header."
            ),
        )
    settings = get_settings()
    return ElevenLabsMusicService(
        api_key=api_key,
        base_url=settings.elevenlabs_base_url,
    )


@lru_cache(maxsize=1)
def get_song_repository() -> SupabaseSongsRepository:
    settings = get_settings()
    return SupabaseSongsRepository(
        url=settings.supabase_url,
        service_role_key=settings.supabase_service_role_key,
        bucket=settings.supabase_storage_bucket,
        image_bucket=settings.supabase_image_storage_bucket,
    )


def get_optional_title_service(request: Request) -> OpenAITextService | None:
    api_key = resolve_openai_api_key(request)
    if not api_key:
        return None
    return OpenAITextService(api_key=api_key)


def get_optional_image_service(request: Request) -> OpenAIImageService | None:
    api_key = resolve_openai_api_key(request)
    if not api_key:
        return None
    return OpenAIImageService(api_key=api_key)


@lru_cache(maxsize=1)
def get_optional_album_video_service() -> AlbumVideoService | None:
    settings = get_settings()
    if not settings.album_video_service_base_url:
        return None
    return AlbumVideoService(base_url=settings.album_video_service_base_url)


def sanitize_title(title: str | None) -> str | None:
    if not title:
        return None

    cleaned = title.strip().strip("\"'").strip()
    if not cleaned:
        return None

    return cleaned[:200]


def resolve_generated_title(
    request: Request,
    lyrics: str | None,
    fallback_title: str | None,
) -> str | None:
    if lyrics and lyrics.strip():
        title_service = get_optional_title_service(request)
        if title_service is not None:
            try:
                return sanitize_title(
                    title_service.generate_title_from_lyrics(
                        lyrics=lyrics,
                        model="gpt-5.4-mini",
                    )
                )
            except OpenAITextError:
                return sanitize_title(derive_title_from_lyrics(lyrics))

        return sanitize_title(derive_title_from_lyrics(lyrics))

    return sanitize_title(fallback_title)


def start_cover_generation(
    request: Request,
    *,
    title: str | None,
    prompt: str | None,
    lyrics: str | None,
) -> tuple[ThreadPoolExecutor | None, Future[tuple[bytes, str]] | None]:
    image_service = get_optional_image_service(request)
    if image_service is None:
        return None, None

    executor: ThreadPoolExecutor = ThreadPoolExecutor(max_workers=1)
    future = executor.submit(
        image_service.generate_cover_image,
        title=title,
        prompt=prompt,
        lyrics=lyrics,
    )
    return executor, future


def decode_supplied_cover_image(
    *,
    image_base64: str | None,
    mime_type: str | None,
) -> tuple[bytes, str] | None:
    if not image_base64 or not mime_type:
        return None

    try:
        return base64.b64decode(image_base64, validate=True), mime_type
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Provided cover image was not valid base64.",
        )


def clamp_video_duration_seconds(duration_ms: int | None) -> int:
    if duration_ms is None:
        return 8
    duration_seconds = round(duration_ms / 1000)
    return max(4, min(duration_seconds, 12))


def clamp_video_theme(theme: str | None) -> str | None:
    if not theme:
        return None

    normalized = " ".join(theme.split()).strip()
    if not normalized:
        return None

    return normalized[:120]


def resolve_video_theme(
    request: Request,
    *,
    title: str | None,
    prompt: str | None,
    lyrics: str | None,
) -> str | None:
    title_service = get_optional_title_service(request)
    if title_service is not None:
        try:
            theme = title_service.generate_video_theme(
                title=title,
                prompt=prompt,
                lyrics=lyrics,
                model="gpt-5.4-mini",
            )
            clamped = clamp_video_theme(theme)
            if clamped:
                return clamped
        except OpenAITextError:
            pass

    fallback_source = title or prompt or lyrics
    return clamp_video_theme(fallback_source)


def maybe_start_song_video_generation(
    request: Request,
    *,
    repository: SupabaseSongsRepository,
    song: SongRecord,
) -> SongRecord:
    if song.video_job_id or song.status != "completed":
        return song

    video_service = get_optional_album_video_service()
    if video_service is None:
        return song

    openai_api_key = resolve_openai_api_key(request)
    if not openai_api_key:
        return song

    try:
        started = video_service.start_generation(
            song_id=str(song.id),
            title=song.title,
            artist_name="Slopify AI",
            lyrics=song.lyrics,
            genre=None,
            mood=None,
            theme=resolve_video_theme(
                request,
                title=song.title,
                prompt=song.prompt,
                lyrics=song.lyrics,
            ),
            duration_seconds=clamp_video_duration_seconds(song.music_length_ms),
            openai_api_key=openai_api_key,
        )
        return repository.mark_song_video_job_started(song.id, started.job_id)
    except AlbumVideoError as exc:
        return repository.update_song_video_status(
            song.id,
            status="failed",
            video_url=None,
            error=str(exc),
        )


def maybe_start_song_variant_video_generation(
    request: Request,
    *,
    repository: SupabaseSongsRepository,
    session: SongSessionDetail,
    variant: SongVariantRecord,
) -> SongVariantRecord:
    if variant.video_job_id or variant.status != "completed":
        return variant

    video_service = get_optional_album_video_service()
    if video_service is None:
        return variant

    openai_api_key = resolve_openai_api_key(request)
    if not openai_api_key:
        return variant

    try:
        started = video_service.start_generation(
            song_id=str(variant.id),
            title=variant.title or session.title,
            artist_name="Slopify AI",
            lyrics=variant.lyrics or session.lyrics,
            genre=None,
            mood=None,
            theme=resolve_video_theme(
                request,
                title=variant.title or session.title,
                prompt=variant.prompt or session.prompt,
                lyrics=variant.lyrics or session.lyrics,
            ),
            duration_seconds=clamp_video_duration_seconds(
                variant.music_length_ms or session.music_length_ms
            ),
            openai_api_key=openai_api_key,
        )
        return repository.mark_song_variant_video_job_started(
            variant.id,
            started.job_id,
        )
    except AlbumVideoError as exc:
        return repository.update_song_variant_video_status(
            variant.id,
            status="failed",
            video_url=None,
            error=str(exc),
        )


def maybe_refresh_song_video_status(
    request: Request,
    *,
    repository: SupabaseSongsRepository,
    song: SongRecord,
) -> SongRecord:
    if not song.video_job_id or song.video_status not in {"queued", "processing"}:
        return song

    video_service = get_optional_album_video_service()
    if video_service is None:
        return song

    openai_api_key = resolve_openai_api_key(request)
    if not openai_api_key:
        return song

    try:
        status_result = video_service.get_status(
            song.video_job_id,
            openai_api_key=openai_api_key,
        )
    except AlbumVideoError:
        return song

    return repository.update_song_video_status(
        song.id,
        status=status_result.status,
        video_url=status_result.video_url,
        error=status_result.error,
    )


def maybe_refresh_song_variant_video_status(
    request: Request,
    *,
    repository: SupabaseSongsRepository,
    variant: SongVariantRecord,
) -> SongVariantRecord:
    if (
        not variant.video_job_id
        or variant.video_status not in {"queued", "processing"}
    ):
        return variant

    video_service = get_optional_album_video_service()
    if video_service is None:
        return variant

    openai_api_key = resolve_openai_api_key(request)
    if not openai_api_key:
        return variant

    try:
        status_result = video_service.get_status(
            variant.video_job_id,
            openai_api_key=openai_api_key,
        )
    except AlbumVideoError:
        return variant

    return repository.update_song_variant_video_status(
        variant.id,
        status=status_result.status,
        video_url=status_result.video_url,
        error=status_result.error,
    )


def require_image_service(request: Request) -> OpenAIImageService:
    image_service = get_optional_image_service(request)
    if image_service is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "OpenAI API key is required for cover image generation. "
                "Provide it in the x-openai-api-key header."
            ),
        )
    return image_service


def maybe_attach_song_cover(
    *,
    repository: SupabaseSongsRepository,
    song_id: UUID,
    executor: ThreadPoolExecutor | None,
    future: Future[tuple[bytes, str]] | None,
) -> None:
    if future is None:
        return

    try:
        image_bytes, mime_type = future.result()
        repository.attach_song_cover(song_id, image_bytes, mime_type)
    except OpenAIImageError:
        return
    except Exception:
        return
    finally:
        if executor is not None:
            executor.shutdown(wait=False)


def maybe_attach_song_session_cover(
    *,
    repository: SupabaseSongsRepository,
    session_id: UUID,
    executor: ThreadPoolExecutor | None,
    future: Future[tuple[bytes, str]] | None,
) -> None:
    if future is None:
        return

    try:
        image_bytes, mime_type = future.result()
        repository.attach_song_session_cover(session_id, image_bytes, mime_type)
    except OpenAIImageError:
        return
    except Exception:
        return
    finally:
        if executor is not None:
            executor.shutdown(wait=False)


def attach_supplied_song_cover(
    *,
    repository: SupabaseSongsRepository,
    song_id: UUID,
    image_bytes: bytes,
    mime_type: str,
) -> None:
    try:
        repository.attach_song_cover(song_id, image_bytes, mime_type)
    except Exception:
        return


def attach_supplied_song_session_cover(
    *,
    repository: SupabaseSongsRepository,
    session_id: UUID,
    image_bytes: bytes,
    mime_type: str,
) -> None:
    try:
        repository.attach_song_session_cover(session_id, image_bytes, mime_type)
    except Exception:
        return


@router.post(
    "/cover/generate",
    response_model=GenerateCoverImageResponse,
    status_code=status.HTTP_201_CREATED,
)
def generate_cover_image(
    request: GenerateCoverImageRequest,
    http_request: Request,
) -> GenerateCoverImageResponse:
    image_service = require_image_service(http_request)
    try:
        image_bytes, mime_type = image_service.generate_cover_image(
            title=request.title,
            prompt=request.prompt,
            lyrics=request.lyrics,
        )
    except OpenAIImageError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={
                "message": "Cover image generation failed.",
                "provider_error": str(exc),
            },
        ) from exc

    return GenerateCoverImageResponse(
        image_base64=base64.b64encode(image_bytes).decode("ascii"),
        mime_type=mime_type,
    )


@router.post(
    "/generate",
    response_model=SongRecord,
    status_code=status.HTTP_201_CREATED,
)
def generate_song(
    http_request: Request,
    request: SongGenerateRequest,
    repository: SupabaseSongsRepository = Depends(get_song_repository),
    music_service: ElevenLabsMusicService = Depends(get_music_service),
) -> SongRecord:
    request = request.model_copy(
        update={
            "title": resolve_generated_title(
                http_request,
                request.lyrics,
                request.title,
            )
        }
    )
    song = repository.create_song(request)
    supplied_cover = decode_supplied_cover_image(
        image_base64=request.cover_image_base64,
        mime_type=request.cover_image_mime_type,
    )
    image_executor: ThreadPoolExecutor | None = None
    image_future: Future[tuple[bytes, str]] | None = None
    if supplied_cover is None:
        image_executor, image_future = start_cover_generation(
            http_request,
            title=request.title,
            prompt=request.prompt,
            lyrics=request.lyrics,
        )
    try:
        generated_song = music_service.generate_song(request)
        completed_song = repository.mark_song_completed(
            song_id=song.id,
            audio_bytes=generated_song.audio_bytes,
            mime_type=generated_song.mime_type,
        )
        if supplied_cover is not None:
            image_bytes, mime_type = supplied_cover
            attach_supplied_song_cover(
                repository=repository,
                song_id=song.id,
                image_bytes=image_bytes,
                mime_type=mime_type,
            )
        else:
            maybe_attach_song_cover(
                repository=repository,
                song_id=song.id,
                executor=image_executor,
                future=image_future,
            )
        final_song = repository.get_song(completed_song.id)
        return maybe_start_song_video_generation(
            http_request,
            repository=repository,
            song=final_song,
        )
    except ElevenLabsError as exc:
        repository.mark_song_failed(song.id, str(exc))
        if image_executor is not None:
            image_executor.shutdown(wait=False)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={
                "message": "ElevenLabs generation failed.",
                "song_id": str(song.id),
                "provider_error": str(exc),
            },
        ) from exc
    except Exception as exc:
        repository.mark_song_failed(song.id, str(exc))
        if image_executor is not None:
            image_executor.shutdown(wait=False)
        raise


@router.post(
    "/sessions/generate",
    response_model=SongSessionDetail,
    status_code=status.HTTP_201_CREATED,
)
def generate_song_session(
    http_request: Request,
    request: SongSessionGenerateRequest,
    repository: SupabaseSongsRepository = Depends(get_song_repository),
    music_service: ElevenLabsMusicService = Depends(get_music_service),
) -> SongSessionDetail:
    request = request.model_copy(
        update={
            "title": resolve_generated_title(
                http_request,
                request.lyrics,
                request.title,
            )
        }
    )
    session = repository.create_song_session(request)
    supplied_cover = decode_supplied_cover_image(
        image_base64=request.cover_image_base64,
        mime_type=request.cover_image_mime_type,
    )
    image_executor: ThreadPoolExecutor | None = None
    image_future: Future[tuple[bytes, str]] | None = None
    if supplied_cover is None:
        image_executor, image_future = start_cover_generation(
            http_request,
            title=request.title,
            prompt=request.prompt,
            lyrics=request.lyrics,
        )
    for variant_index in range(1, request.candidate_count + 1):
        variant = repository.create_song_variant(session.id, request, variant_index)
        try:
            generated_song = music_service.generate_song(request)
            repository.mark_song_variant_completed(
                variant_id=variant.id,
                audio_bytes=generated_song.audio_bytes,
                mime_type=generated_song.mime_type,
            )
        except ElevenLabsError as exc:
            repository.mark_song_variant_failed(variant.id, str(exc))
        except Exception as exc:
            repository.mark_song_variant_failed(variant.id, str(exc))

    if supplied_cover is not None:
        image_bytes, mime_type = supplied_cover
        attach_supplied_song_session_cover(
            repository=repository,
            session_id=session.id,
            image_bytes=image_bytes,
            mime_type=mime_type,
        )
    else:
        maybe_attach_song_session_cover(
            repository=repository,
            session_id=session.id,
            executor=image_executor,
            future=image_future,
        )
    detail = repository.finalize_song_session(session.id)
    if all(variant.status == "failed" for variant in detail.variants):
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={
                "message": "All song variants failed.",
                "session_id": str(session.id),
                "variant_errors": [
                    {
                        "variant_id": str(variant.id),
                        "variant_index": variant.variant_index,
                        "provider_error": variant.error_message,
                    }
                    for variant in detail.variants
                ],
            },
        )
    return detail


@router.get("", response_model=SongListResponse)
def list_songs(
    request: Request,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    repository: SupabaseSongsRepository = Depends(get_song_repository),
) -> SongListResponse:
    items, total = repository.list_songs(limit=limit, offset=offset)
    items = [
        maybe_refresh_song_video_status(request, repository=repository, song=item)
        for item in items
    ]
    return SongListResponse(items=items, total=total)


@router.get("/sessions", response_model=SongSessionListResponse)
def list_song_sessions(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    repository: SupabaseSongsRepository = Depends(get_song_repository),
) -> SongSessionListResponse:
    items, total = repository.list_song_sessions(limit=limit, offset=offset)
    return SongSessionListResponse(items=items, total=total)


@router.get("/sessions/{session_id}", response_model=SongSessionDetail)
def get_song_session(
    request: Request,
    session_id: UUID,
    repository: SupabaseSongsRepository = Depends(get_song_repository),
) -> SongSessionDetail:
    try:
        session = repository.get_song_session(session_id)
        refreshed_variants = [
            maybe_refresh_song_variant_video_status(
                request,
                repository=repository,
                variant=variant,
            )
            for variant in session.variants
        ]
        return SongSessionDetail(
            **session.model_dump(exclude={"variants"}),
            variants=refreshed_variants,
        )
    except SongSessionNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Song session {session_id} was not found.",
        ) from exc


@router.post(
    "/sessions/{session_id}/select/{variant_id}",
    response_model=SongVariantSelectionResponse,
)
def select_song_variant(
    http_request: Request,
    session_id: UUID,
    variant_id: UUID,
    repository: SupabaseSongsRepository = Depends(get_song_repository),
) -> SongVariantSelectionResponse:
    try:
        session = repository.get_song_session(session_id)
        if session.selected_variant_id or session.selected_song_id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A song has already been selected for this session.",
            )
        variant = repository.get_song_variant(variant_id)
        if variant.status != "completed" or not variant.storage_path or not variant.mime_type:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Only completed song variants can be selected.",
            )
        song = repository.select_song_variant(session_id, variant_id)
        maybe_start_song_video_generation(
            http_request,
            repository=repository,
            song=song,
        )
        session = repository.get_song_session(session_id)
        return SongVariantSelectionResponse(session=session, selected_variant=variant)
    except SongSessionNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Song session {session_id} was not found.",
        ) from exc
    except SongVariantNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Song variant {variant_id} was not found.",
        ) from exc


@router.get("/{song_id}", response_model=SongRecord)
def get_song(
    request: Request,
    song_id: UUID,
    repository: SupabaseSongsRepository = Depends(get_song_repository),
) -> SongRecord:
    try:
        song = repository.get_song(song_id)
        return maybe_refresh_song_video_status(request, repository=repository, song=song)
    except SongNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Song {song_id} was not found.",
        ) from exc


@router.get("/variants/{variant_id}/audio")
def get_song_variant_audio(
    variant_id: UUID,
    repository: SupabaseSongsRepository = Depends(get_song_repository),
) -> Response:
    try:
        variant = repository.get_song_variant(variant_id)
    except SongVariantNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Song variant {variant_id} was not found.",
        ) from exc

    if (
        variant.status != "completed"
        or not variant.storage_path
        or not variant.mime_type
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Song variant audio is not available yet.",
        )

    audio_bytes = repository.download_audio(variant.storage_path)
    filename = f"{variant.id}.{variant.storage_path.rsplit('.', 1)[-1]}"
    return StreamingResponse(
        BytesIO(audio_bytes),
        media_type=variant.mime_type,
        headers={"Content-Disposition": f'inline; filename="{filename}"'},
    )


@router.get("/sessions/{session_id}/image")
def get_song_session_image(
    session_id: UUID,
    repository: SupabaseSongsRepository = Depends(get_song_repository),
) -> Response:
    try:
        session = repository.get_song_session(session_id)
    except SongSessionNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Song session {session_id} was not found.",
        ) from exc

    if not session.image_storage_path or not session.image_mime_type:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Song session cover image is not available yet.",
        )

    image_bytes = repository.download_image(session.image_storage_path)
    filename = f"{session.id}.{session.image_storage_path.rsplit('.', 1)[-1]}"
    return StreamingResponse(
        BytesIO(image_bytes),
        media_type=session.image_mime_type,
        headers={"Content-Disposition": f'inline; filename="{filename}"'},
    )


@router.get("/{song_id}/audio")
def get_song_audio(
    song_id: UUID,
    repository: SupabaseSongsRepository = Depends(get_song_repository),
) -> Response:
    try:
        song = repository.get_song(song_id)
    except SongNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Song {song_id} was not found.",
        ) from exc

    if song.status != "completed" or not song.storage_path or not song.mime_type:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Song audio is not available yet.",
        )

    audio_bytes = repository.download_audio(song.storage_path)
    filename = f"{song.id}.{song.storage_path.rsplit('.', 1)[-1]}"
    return StreamingResponse(
        BytesIO(audio_bytes),
        media_type=song.mime_type,
        headers={"Content-Disposition": f'inline; filename="{filename}"'},
    )


@router.get("/{song_id}/image")
def get_song_image(
    song_id: UUID,
    repository: SupabaseSongsRepository = Depends(get_song_repository),
) -> Response:
    try:
        song = repository.get_song(song_id)
    except SongNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Song {song_id} was not found.",
        ) from exc

    if not song.image_storage_path or not song.image_mime_type:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Song cover image is not available yet.",
        )

    image_bytes = repository.download_image(song.image_storage_path)
    filename = f"{song.id}.{song.image_storage_path.rsplit('.', 1)[-1]}"
    return StreamingResponse(
        BytesIO(image_bytes),
        media_type=song.image_mime_type,
        headers={"Content-Disposition": f'inline; filename="{filename}"'},
    )
