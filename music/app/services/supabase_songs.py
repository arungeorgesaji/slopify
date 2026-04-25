from __future__ import annotations

from typing import Any
from uuid import UUID

from supabase import Client, create_client

from app.models import SongGenerateRequest, SongRecord


class SongNotFoundError(Exception):
    """Raised when a song record does not exist."""


class SupabaseSongsRepository:
    def __init__(self, url: str, service_role_key: str, bucket: str) -> None:
        self._bucket = bucket
        self._client: Client = create_client(url, service_role_key)

    def create_song(self, request: SongGenerateRequest) -> SongRecord:
        payload = {
            "user_id": str(request.user_id) if request.user_id else None,
            "title": request.title,
            "prompt": request.prompt,
            "composition_plan": request.composition_plan,
            "model_id": request.model_id,
            "music_length_ms": request.music_length_ms,
            "force_instrumental": request.force_instrumental,
            "respect_sections_durations": request.respect_sections_durations,
            "status": "processing",
            "storage_bucket": self._bucket,
        }
        result = self._client.table("songs").insert(payload).execute()
        return SongRecord.model_validate(result.data[0])

    def mark_song_failed(self, song_id: UUID, error_message: str) -> SongRecord:
        result = (
            self._client.table("songs")
            .update(
                {
                    "status": "failed",
                    "error_message": error_message[:2000],
                }
            )
            .eq("id", str(song_id))
            .execute()
        )
        return SongRecord.model_validate(result.data[0])

    def mark_song_completed(
        self,
        song_id: UUID,
        audio_bytes: bytes,
        mime_type: str,
    ) -> SongRecord:
        extension = self._extension_from_mime_type(mime_type)
        storage_path = f"{song_id}/song.{extension}"

        self._client.storage.from_(self._bucket).upload(
            storage_path,
            audio_bytes,
            {"content-type": mime_type},
        )

        result = (
            self._client.table("songs")
            .update(
                {
                    "status": "completed",
                    "storage_path": storage_path,
                    "mime_type": mime_type,
                    "size_bytes": len(audio_bytes),
                    "error_message": None,
                }
            )
            .eq("id", str(song_id))
            .execute()
        )
        return SongRecord.model_validate(result.data[0])

    def get_song(self, song_id: UUID) -> SongRecord:
        result = (
            self._client.table("songs")
            .select("*")
            .eq("id", str(song_id))
            .limit(1)
            .execute()
        )
        if not result.data:
            raise SongNotFoundError(str(song_id))
        return SongRecord.model_validate(result.data[0])

    def list_songs(self, limit: int, offset: int) -> tuple[list[SongRecord], int]:
        result = (
            self._client.table("songs")
            .select("*", count="exact")
            .order("created_at", desc=True)
            .range(offset, offset + limit - 1)
            .execute()
        )
        items = [SongRecord.model_validate(item) for item in result.data or []]
        total = result.count or 0
        return items, total

    def download_audio(self, storage_path: str) -> bytes:
        return self._client.storage.from_(self._bucket).download(storage_path)

    @staticmethod
    def _extension_from_mime_type(mime_type: str) -> str:
        mapping: dict[str, str] = {
            "audio/mpeg": "mp3",
            "audio/mp3": "mp3",
            "audio/wav": "wav",
            "audio/x-wav": "wav",
            "audio/ogg": "ogg",
        }
        return mapping.get(mime_type.lower(), "mp3")
