from __future__ import annotations

from fastapi import Request

from app.config import get_settings

OPENAI_API_KEY_HEADER = "x-openai-api-key"
ELEVENLABS_API_KEY_HEADER = "x-elevenlabs-api-key"


def resolve_openai_api_key(request: Request) -> str | None:
    header_value = request.headers.get(OPENAI_API_KEY_HEADER, "").strip()
    if header_value:
        return header_value

    settings = get_settings()
    return settings.openai_api_key


def resolve_elevenlabs_api_key(request: Request) -> str | None:
    header_value = request.headers.get(ELEVENLABS_API_KEY_HEADER, "").strip()
    if header_value:
        return header_value

    settings = get_settings()
    return settings.elevenlabs_api_key
