from __future__ import annotations

from functools import lru_cache
from io import BytesIO
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from fastapi.responses import StreamingResponse

from app.config import Settings, get_settings
from app.models import SongGenerateRequest, SongListResponse, SongRecord
from app.services.elevenlabs_music import ElevenLabsError, ElevenLabsMusicService
from app.services.supabase_songs import SongNotFoundError, SupabaseSongsRepository

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
    song = repository.create_song(request)
    try:
        generated_song = music_service.generate_song(request)
        return repository.mark_song_completed(
            song_id=song.id,
            audio_bytes=generated_song.audio_bytes,
            mime_type=generated_song.mime_type,
        )
    except ElevenLabsError as exc:
        repository.mark_song_failed(song.id, str(exc))
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
        raise


@router.get("", response_model=SongListResponse)
def list_songs(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    repository: SupabaseSongsRepository = Depends(get_song_repository),
) -> SongListResponse:
    items, total = repository.list_songs(limit=limit, offset=offset)
    return SongListResponse(items=items, total=total)


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
