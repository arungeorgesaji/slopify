from __future__ import annotations

import base64

import httpx


IMAGE_MODEL = "dall-e-3"
IMAGE_SIZE = "1024x1024"
IMAGE_QUALITY = "standard"
IMAGE_STYLE = "vivid"
IMAGE_RESPONSE_FORMAT = "b64_json"
IMAGE_MIME_TYPE = "image/png"

COVER_ART_INSTRUCTIONS = """
Create a square album cover for a generated song.

Rules:
- Return a single original cover image.
- No text, typography, logos, watermarks, or UI chrome.
- Make it feel like polished streaming-cover artwork, not a poster.
- Prioritize one strong central visual idea with cinematic lighting.
- Reflect the song's mood, genre, imagery, and emotional tone.
- Keep the composition readable as a thumbnail.
""".strip()


class OpenAIImageError(Exception):
    """Raised when OpenAI image generation fails."""


class OpenAIImageService:
    def __init__(self, api_key: str, timeout: float = 90.0) -> None:
        self._api_key = api_key
        self._timeout = timeout

    def generate_cover_image(
        self,
        *,
        title: str | None,
        prompt: str | None,
        lyrics: str | None,
    ) -> tuple[bytes, str]:
        payload = {
            "model": IMAGE_MODEL,
            "prompt": self._build_cover_prompt(
                title=title,
                prompt=prompt,
                lyrics=lyrics,
            ),
            "size": IMAGE_SIZE,
            "quality": IMAGE_QUALITY,
            "style": IMAGE_STYLE,
            "response_format": IMAGE_RESPONSE_FORMAT,
            "n": 1,
        }

        try:
            response = httpx.post(
                "https://api.openai.com/v1/images/generations",
                headers={
                    "Authorization": f"Bearer {self._api_key}",
                    "Content-Type": "application/json",
                },
                json=payload,
                timeout=self._timeout,
            )
            response.raise_for_status()
        except Exception as exc:
            raise OpenAIImageError(str(exc)) from exc

        try:
            body = response.json()
            image_base64 = body["data"][0]["b64_json"]
            image_bytes = base64.b64decode(image_base64)
        except Exception as exc:
            raise OpenAIImageError("The image API returned an invalid payload.") from exc

        if not image_bytes:
            raise OpenAIImageError("The image API returned an empty image.")

        return image_bytes, IMAGE_MIME_TYPE

    @staticmethod
    def _build_cover_prompt(
        *,
        title: str | None,
        prompt: str | None,
        lyrics: str | None,
    ) -> str:
        sections = [COVER_ART_INSTRUCTIONS]

        if title and title.strip():
            sections.append(f"Song title: {title.strip()}")

        if prompt and prompt.strip():
            sections.append(f"Song brief: {prompt.strip()}")

        if lyrics and lyrics.strip():
            sections.append(
                "Lyrics excerpt and imagery cues:\n"
                f"{lyrics.strip()[:2500]}"
            )

        sections.append(
            "Design direction: modern album art, dramatic but clean, high contrast, "
            "emotionally specific, suitable for a music library thumbnail."
        )
        return "\n\n".join(sections)
