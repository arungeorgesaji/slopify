from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request, status

from app.models import (
    EnhancePromptRequest,
    EnhancePromptResponse,
    GenerateLyricsRequest,
    GenerateLyricsResponse,
)
from app.services.openai_text import OpenAITextError, OpenAITextService
from app.services.provider_keys import resolve_openai_api_key

router = APIRouter(tags=["prompt"])


def require_openai_text_service(request: Request) -> OpenAITextService:
    api_key = resolve_openai_api_key(request)
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "OpenAI API key is required for this action. "
                "Provide it in the x-openai-api-key header."
            ),
        )
    return OpenAITextService(api_key=api_key)


@router.post("/enhance-prompt", response_model=EnhancePromptResponse)
def enhance_prompt(
    payload: EnhancePromptRequest,
    request: Request,
) -> EnhancePromptResponse:
    try:
        enhanced_prompt = require_openai_text_service(request).enhance_prompt(
            prompt=payload.prompt,
            model=payload.model,
        )
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
def generate_lyrics(
    payload: GenerateLyricsRequest,
    request: Request,
) -> GenerateLyricsResponse:
    try:
        lyrics = require_openai_text_service(request).generate_lyrics(
            prompt=payload.prompt,
            model=payload.model,
        )
    except OpenAITextError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        ) from exc

    return GenerateLyricsResponse(
        lyrics=lyrics,
        model=payload.model,
    )
