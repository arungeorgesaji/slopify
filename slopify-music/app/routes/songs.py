from __future__ import annotations

import base64
from concurrent.futures import Future, ThreadPoolExecutor
from functools import lru_cache
from io import BytesIO
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
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
    SongVariantSelectionResponse,
)
from app.services.elevenlabs_music import ElevenLabsError, ElevenLabsMusicService
from app.services.openai_images import OpenAIImageError, OpenAIImageService
from app.services.openai_text import (
    OpenAITextError,
    OpenAITextService,
    derive_title_from_lyrics,
)
from app.services.supabase_songs import (
    SongNotFoundError,
    SongSessionNotFoundError,
    SongVariantNotFoundError,
    SupabaseSongsRepository,
)

router = APIRouter(prefix="/songs", tags=["songs"])


@lru_cache(maxsize=1)
def get_music_service() -> ElevenLabsMusicService:
    settings = get_settings()
    return ElevenLabsMusicService(
        api_key=settings.elevenlabs_api_key,
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


@lru_cache(maxsize=1)
def get_optional_title_service() -> OpenAITextService | None:
    settings = get_settings()
    if not settings.openai_api_key:
        return None
    return OpenAITextService(api_key=settings.openai_api_key)


@lru_cache(maxsize=1)
def get_optional_image_service() -> OpenAIImageService | None:
    settings = get_settings()
    if not settings.openai_api_key:
        return None
    return OpenAIImageService(api_key=settings.openai_api_key)


def sanitize_title(title: str | None) -> str | None:
    if not title:
        return None

    cleaned = title.strip().strip("\"'").strip()
    if not cleaned:
        return None

    return cleaned[:200]


def resolve_generated_title(
    lyrics: str | None,
    fallback_title: str | None,
) -> str | None:
    if lyrics and lyrics.strip():
        title_service = get_optional_title_service()
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
    *,
    title: str | None,
    prompt: str | None,
    lyrics: str | None,
) -> tuple[ThreadPoolExecutor | None, Future[tuple[bytes, str]] | None]:
    image_service = get_optional_image_service()
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


def decode_cover_image_request(request: SongGenerateRequest | SongSessionGenerateRequest) -> tuple[bytes, str] | None:
    if not request.cover_image_base64 or not request.cover_image_mime_type:
        return None

    try:
        return (
            base64.b64decode(request.cover_image_base64),
            request.cover_image_mime_type,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Cover image payload was invalid.",
        ) from exc


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


@router.post(
    "/cover/generate",
    response_model=GenerateCoverImageResponse,
    status_code=status.HTTP_201_CREATED,
)
def generate_cover_image(
    request: GenerateCoverImageRequest,
) -> GenerateCoverImageResponse:
    image_service = get_optional_image_service()
    if image_service is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Cover image generation is not configured.",
        )

    try:
        image_bytes, mime_type = image_service.generate_cover_image(
            title=sanitize_title(request.title),
            prompt=request.prompt,
            lyrics=request.lyrics,
        )
    except OpenAIImageError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Cover image generation failed: {exc}",
        ) from exc

    return GenerateCoverImageResponse(
        image_base64=base64.b64encode(image_bytes).decode("utf-8"),
        mime_type=mime_type,
        model="dall-e-3",
    )


@router.post(
    "/generate",
    response_model=SongRecord,
    status_code=status.HTTP_201_CREATED,
)
def generate_song(
    request: SongGenerateRequest,
    repository: SupabaseSongsRepository = Depends(get_song_repository),
    music_service: ElevenLabsMusicService = Depends(get_music_service),
) -> SongRecord:
    request = request.model_copy(
        update={"title": resolve_generated_title(request.lyrics, request.title)}
    )
    song = repository.create_song(request)
    provided_cover = decode_cover_image_request(request)
    image_executor = None
    image_future = None
    if provided_cover is None:
        image_executor, image_future = start_cover_generation(
            title=request.title,
            prompt=request.prompt,
            lyrics=request.lyrics,
        )
    else:
        repository.attach_song_cover(song.id, provided_cover[0], provided_cover[1])
    try:
        generated_song = music_service.generate_song(request)
        completed_song = repository.mark_song_completed(
            song_id=song.id,
            audio_bytes=generated_song.audio_bytes,
            mime_type=generated_song.mime_type,
        )
        maybe_attach_song_cover(
            repository=repository,
            song_id=song.id,
            executor=image_executor,
            future=image_future,
        )
        return repository.get_song(completed_song.id)
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
    request: SongSessionGenerateRequest,
    repository: SupabaseSongsRepository = Depends(get_song_repository),
    music_service: ElevenLabsMusicService = Depends(get_music_service),
) -> SongSessionDetail:
    request = request.model_copy(
        update={"title": resolve_generated_title(request.lyrics, request.title)}
    )
    session = repository.create_song_session(request)
    provided_cover = decode_cover_image_request(request)
    image_executor = None
    image_future = None
    if provided_cover is None:
        image_executor, image_future = start_cover_generation(
            title=request.title,
            prompt=request.prompt,
            lyrics=request.lyrics,
        )
    else:
        repository.attach_song_session_cover(
            session.id,
            provided_cover[0],
            provided_cover[1],
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
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    repository: SupabaseSongsRepository = Depends(get_song_repository),
) -> SongListResponse:
    items, total = repository.list_songs(limit=limit, offset=offset)
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
    session_id: UUID,
    repository: SupabaseSongsRepository = Depends(get_song_repository),
) -> SongSessionDetail:
    try:
        return repository.get_song_session(session_id)
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
    session_id: UUID,
    variant_id: UUID,
    repository: SupabaseSongsRepository = Depends(get_song_repository),
) -> SongVariantSelectionResponse:
    try:
        variant = repository.get_song_variant(variant_id)
        if variant.status != "completed" or not variant.storage_path or not variant.mime_type:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Only completed song variants can be selected.",
            )
        repository.select_song_variant(session_id, variant_id)
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
    song_id: UUID,
    repository: SupabaseSongsRepository = Depends(get_song_repository),
) -> SongRecord:
    try:
        return repository.get_song(song_id)
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
