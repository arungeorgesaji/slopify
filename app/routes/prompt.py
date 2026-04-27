from __future__ import annotations

from functools import lru_cache

from fastapi import APIRouter, HTTPException, status

from app.config import get_settings
from app.models import (
    EnhancePromptRequest,
    EnhancePromptResponse,
    GenerateLyricsRequest,
    GenerateLyricsResponse,
)
from app.services.openai_text import OpenAITextError, OpenAITextService

router = APIRouter(tags=["prompt"])


@lru_cache(maxsize=1)
def get_openai_text_service() -> OpenAITextService:
    settings = get_settings()
    if not settings.openai_api_key:
        raise RuntimeError("OPENAI_API_KEY is not set.")
    return OpenAITextService(api_key=settings.openai_api_key)


@router.post("/enhance-prompt", response_model=EnhancePromptResponse)
def enhance_prompt(payload: EnhancePromptRequest) -> EnhancePromptResponse:
    try:
        enhanced_prompt = get_openai_text_service().enhance_prompt(
            prompt=payload.prompt,
            model=payload.model,
        )
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        ) from exc
    except OpenAITextError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        ) from exc

    return EnhancePromptResponse(
        enhanced_prompt=enhanced_prompt,
        model=payload.model,
    )


@router.post("/generate-lyrics", response_model=GenerateLyricsResponse)
def generate_lyrics(payload: GenerateLyricsRequest) -> GenerateLyricsResponse:
    try:
        lyrics = get_openai_text_service().generate_lyrics(
            prompt=payload.prompt,
            model=payload.model,
        )
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        ) from exc
    except OpenAITextError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        ) from exc

    return GenerateLyricsResponse(
        lyrics=lyrics,
        model=payload.model,
    )
