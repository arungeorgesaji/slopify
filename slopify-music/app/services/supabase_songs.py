from __future__ import annotations

from uuid import UUID

from supabase import Client, create_client

from app.models import (
    SongGenerateRequest,
    SongRecord,
    SongSessionDetail,
    SongSessionGenerateRequest,
    SongSessionRecord,
    SongVariantRecord,
)


class SongNotFoundError(Exception):
    """Raised when a song record does not exist."""


class SongSessionNotFoundError(Exception):
    """Raised when a song session record does not exist."""


class SongVariantNotFoundError(Exception):
    """Raised when a song variant record does not exist."""


class SupabaseSongsRepository:
    def __init__(
        self,
        url: str,
        service_role_key: str,
        bucket: str,
        image_bucket: str,
    ) -> None:
        self._bucket = bucket
        self._image_bucket = image_bucket
        self._client: Client = create_client(url, service_role_key)

    def create_song(self, request: SongGenerateRequest) -> SongRecord:
        payload = {
            "user_id": str(request.user_id) if request.user_id else None,
            "title": request.title,
            "prompt": request.prompt,
            "lyrics": request.lyrics,
            "composition_plan": request.composition_plan,
            "model_id": request.model_id,
            "music_length_ms": request.music_length_ms,
            "force_instrumental": request.force_instrumental,
            "respect_sections_durations": request.respect_sections_durations,
            "status": "processing",
            "storage_bucket": self._bucket,
            "image_storage_bucket": self._image_bucket,
        }
        result = self._client.table("songs").insert(payload).execute()
        return SongRecord.model_validate(result.data[0])

    def create_song_session(
        self,
        request: SongSessionGenerateRequest,
    ) -> SongSessionRecord:
        payload = {
            "user_id": str(request.user_id) if request.user_id else None,
            "title": request.title,
            "prompt": request.prompt,
            "lyrics": request.lyrics,
            "composition_plan": request.composition_plan,
            "model_id": request.model_id,
            "music_length_ms": request.music_length_ms,
            "force_instrumental": request.force_instrumental,
            "respect_sections_durations": request.respect_sections_durations,
            "candidate_count": request.candidate_count,
            "status": "processing",
            "image_storage_bucket": self._image_bucket,
        }
        result = self._client.table("song_sessions").insert(payload).execute()
        return SongSessionRecord.model_validate(result.data[0])

    def create_song_variant(
        self,
        session_id: UUID,
        request: SongSessionGenerateRequest,
        variant_index: int,
    ) -> SongVariantRecord:
        payload = {
            "session_id": str(session_id),
            "variant_index": variant_index,
            "title": request.title,
            "prompt": request.prompt,
            "lyrics": request.lyrics,
            "composition_plan": request.composition_plan,
            "model_id": request.model_id,
            "music_length_ms": request.music_length_ms,
            "force_instrumental": request.force_instrumental,
            "respect_sections_durations": request.respect_sections_durations,
            "status": "processing",
            "storage_bucket": self._bucket,
        }
        result = self._client.table("song_variants").insert(payload).execute()
        return SongVariantRecord.model_validate(result.data[0])

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

    def attach_song_cover(
        self,
        song_id: UUID,
        image_bytes: bytes,
        mime_type: str,
    ) -> SongRecord:
        extension = self._extension_from_image_mime_type(mime_type)
        storage_path = f"{song_id}/cover.{extension}"

        self._client.storage.from_(self._image_bucket).upload(
            storage_path,
            image_bytes,
            {"content-type": mime_type},
        )

        result = (
            self._client.table("songs")
            .update(
                {
                    "image_storage_path": storage_path,
                    "image_mime_type": mime_type,
                }
            )
            .eq("id", str(song_id))
            .execute()
        )
        return SongRecord.model_validate(result.data[0])

    def mark_song_variant_failed(
        self,
        variant_id: UUID,
        error_message: str,
    ) -> SongVariantRecord:
        result = (
            self._client.table("song_variants")
            .update(
                {
                    "status": "failed",
                    "error_message": error_message[:2000],
                }
            )
            .eq("id", str(variant_id))
            .execute()
        )
        if not result.data:
            raise SongVariantNotFoundError(str(variant_id))
        return SongVariantRecord.model_validate(result.data[0])

    def mark_song_variant_completed(
        self,
        variant_id: UUID,
        audio_bytes: bytes,
        mime_type: str,
    ) -> SongVariantRecord:
        extension = self._extension_from_mime_type(mime_type)
        storage_path = f"variants/{variant_id}/song.{extension}"

        self._client.storage.from_(self._bucket).upload(
            storage_path,
            audio_bytes,
            {"content-type": mime_type},
        )

        result = (
            self._client.table("song_variants")
            .update(
                {
                    "status": "completed",
                    "storage_path": storage_path,
                    "mime_type": mime_type,
                    "size_bytes": len(audio_bytes),
                    "error_message": None,
                }
            )
            .eq("id", str(variant_id))
            .execute()
        )
        if not result.data:
            raise SongVariantNotFoundError(str(variant_id))
        return SongVariantRecord.model_validate(result.data[0])

    def finalize_song_session(
        self,
        session_id: UUID,
    ) -> SongSessionDetail:
        variants = self.list_song_variants(session_id)
        completed_count = sum(1 for variant in variants if variant.status == "completed")
        failed_count = sum(1 for variant in variants if variant.status == "failed")

        if completed_count == len(variants):
            status = "completed"
        elif completed_count > 0:
            status = "partial"
        elif failed_count == len(variants):
            status = "failed"
        else:
            status = "processing"

        result = (
            self._client.table("song_sessions")
            .update({"status": status})
            .eq("id", str(session_id))
            .execute()
        )
        if not result.data:
            raise SongSessionNotFoundError(str(session_id))
        session = SongSessionRecord.model_validate(result.data[0])
        return SongSessionDetail(**session.model_dump(), variants=variants)

    def attach_song_session_cover(
        self,
        session_id: UUID,
        image_bytes: bytes,
        mime_type: str,
    ) -> SongSessionRecord:
        extension = self._extension_from_image_mime_type(mime_type)
        storage_path = f"sessions/{session_id}/cover.{extension}"

        self._client.storage.from_(self._image_bucket).upload(
            storage_path,
            image_bytes,
            {"content-type": mime_type},
        )

        result = (
            self._client.table("song_sessions")
            .update(
                {
                    "image_storage_path": storage_path,
                    "image_mime_type": mime_type,
                }
            )
            .eq("id", str(session_id))
            .execute()
        )
        if not result.data:
            raise SongSessionNotFoundError(str(session_id))
        return SongSessionRecord.model_validate(result.data[0])

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

    def get_song_session(self, session_id: UUID) -> SongSessionDetail:
        result = (
            self._client.table("song_sessions")
            .select("*")
            .eq("id", str(session_id))
            .limit(1)
            .execute()
        )
        if not result.data:
            raise SongSessionNotFoundError(str(session_id))
        session = SongSessionRecord.model_validate(result.data[0])
        variants = self.list_song_variants(session_id)
        return SongSessionDetail(**session.model_dump(), variants=variants)

    def list_song_sessions(
        self,
        limit: int,
        offset: int,
    ) -> tuple[list[SongSessionRecord], int]:
        result = (
            self._client.table("song_sessions")
            .select("*", count="exact")
            .order("created_at", desc=True)
            .range(offset, offset + limit - 1)
            .execute()
        )
        items = [SongSessionRecord.model_validate(item) for item in result.data or []]
        total = result.count or 0
        return items, total

    def list_song_variants(self, session_id: UUID) -> list[SongVariantRecord]:
        result = (
            self._client.table("song_variants")
            .select("*")
            .eq("session_id", str(session_id))
            .order("variant_index")
            .execute()
        )
        return [SongVariantRecord.model_validate(item) for item in result.data or []]

    def get_song_variant(self, variant_id: UUID) -> SongVariantRecord:
        result = (
            self._client.table("song_variants")
            .select("*")
            .eq("id", str(variant_id))
            .limit(1)
            .execute()
        )
        if not result.data:
            raise SongVariantNotFoundError(str(variant_id))
        return SongVariantRecord.model_validate(result.data[0])

    def select_song_variant(
        self,
        session_id: UUID,
        variant_id: UUID,
    ) -> SongSessionRecord:
        variant = self.get_song_variant(variant_id)
        if variant.session_id != session_id:
            raise SongVariantNotFoundError(str(variant_id))
        result = (
            self._client.table("song_sessions")
            .update(
                {
                    "selected_variant_id": str(variant_id),
                    "status": "completed",
                }
            )
            .eq("id", str(session_id))
            .execute()
        )
        if not result.data:
            raise SongSessionNotFoundError(str(session_id))
        return SongSessionRecord.model_validate(result.data[0])

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

    def download_image(self, storage_path: str) -> bytes:
        return self._client.storage.from_(self._image_bucket).download(storage_path)

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

    @staticmethod
    def _extension_from_image_mime_type(mime_type: str) -> str:
        mapping: dict[str, str] = {
            "image/png": "png",
            "image/jpeg": "jpg",
            "image/webp": "webp",
        }
        return mapping.get(mime_type.lower(), "png")
