from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

import httpx


AlbumVideoStatus = Literal["queued", "processing", "completed", "failed"]


class AlbumVideoError(Exception):
    """Raised when the album video service returns an error response."""


@dataclass(slots=True)
class AlbumVideoJobStartResult:
    job_id: str


@dataclass(slots=True)
class AlbumVideoJobStatusResult:
    job_id: str
    status: AlbumVideoStatus
    video_url: str | None
    error: str | None


class AlbumVideoService:
    def __init__(self, base_url: str, timeout: float = 30.0) -> None:
        self._base_url = base_url.rstrip("/")
        self._timeout = timeout

    def start_generation(
        self,
        *,
        song_id: str,
        title: str | None,
        artist_name: str | None,
        lyrics: str | None,
        genre: str | None,
        mood: str | None,
        theme: str | None,
        duration_seconds: int,
        aspect_ratio: str = "1:1",
        resolution: str = "720p",
    ) -> AlbumVideoJobStartResult:
        payload = {
            "songId": song_id,
            "title": title or "Untitled song",
            "artistName": artist_name or "Slopify AI",
            "lyrics": (lyrics or "Instrumental mood piece").strip(),
            "genre": genre,
            "mood": mood,
            "theme": theme,
            "durationSeconds": duration_seconds,
            "aspectRatio": aspect_ratio,
            "resolution": resolution,
        }

        try:
            response = httpx.post(
                f"{self._base_url}/album-video/generate",
                json=payload,
                timeout=self._timeout,
            )
            response.raise_for_status()
            body = response.json()
            job_id = body["jobId"]
        except Exception as exc:
            raise AlbumVideoError(str(exc)) from exc

        if not isinstance(job_id, str) or not job_id.strip():
            raise AlbumVideoError("Album video service did not return a jobId.")

        return AlbumVideoJobStartResult(job_id=job_id.strip())

    def get_status(self, job_id: str) -> AlbumVideoJobStatusResult:
        try:
            response = httpx.get(
                f"{self._base_url}/album-video/status/{job_id}",
                timeout=self._timeout,
            )
            response.raise_for_status()
            body = response.json()
        except Exception as exc:
            raise AlbumVideoError(str(exc)) from exc

        status = body.get("status")
        if status not in {"queued", "processing", "completed", "failed"}:
            raise AlbumVideoError("Album video service returned an invalid status.")

        video_url = body.get("videoUrl")
        error = body.get("error")
        return AlbumVideoJobStatusResult(
            job_id=str(body.get("jobId") or job_id),
            status=status,
            video_url=video_url if isinstance(video_url, str) and video_url else None,
            error=error if isinstance(error, str) and error else None,
        )
