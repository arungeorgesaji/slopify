from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import httpx

from app.models import SongGenerateRequest


class ElevenLabsError(Exception):
    """Raised when ElevenLabs returns an error response."""


@dataclass(slots=True)
class GeneratedSong:
    audio_bytes: bytes
    mime_type: str


class ElevenLabsMusicService:
    def __init__(self, api_key: str, base_url: str) -> None:
        self._api_key = api_key
        self._base_url = base_url.rstrip("/")

    def generate_song(self, request: SongGenerateRequest) -> GeneratedSong:
        payload: dict[str, Any] = {
            "model_id": request.model_id,
            "respect_sections_durations": request.respect_sections_durations,
        }
        if request.music_length_ms is not None:
            payload["music_length_ms"] = request.music_length_ms
        if request.prompt is not None:
            payload["prompt"] = request.prompt
            payload["force_instrumental"] = request.force_instrumental
        else:
            payload["composition_plan"] = request.composition_plan

        headers = {
            "xi-api-key": self._api_key,
            "Content-Type": "application/json",
            "Accept": "audio/mpeg",
        }

        with httpx.Client(timeout=httpx.Timeout(180.0, connect=10.0)) as client:
            response = client.post(
                f"{self._base_url}/v1/music",
                headers=headers,
                json=payload,
            )

        if response.is_error:
            try:
                error_payload = response.json()
            except ValueError:
                error_payload = {"detail": response.text}
            raise ElevenLabsError(str(error_payload))

        return GeneratedSong(
            audio_bytes=response.content,
            mime_type=response.headers.get("content-type", "audio/mpeg"),
        )
