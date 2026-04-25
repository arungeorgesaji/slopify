import os
from functools import lru_cache

from fastapi import FastAPI, HTTPException
from openai import OpenAI
from pydantic import BaseModel, Field
from dotenv import load_dotenv


load_dotenv()


PROMPT_ENHANCER_INSTRUCTIONS = """
You enhance user ideas into high-quality music generation prompts.

The final prompt will be passed into ElevenLabs for music generation, so write for a downstream music model rather than for a human conversation.

Rules:
- Return only the enhanced prompt text.
- Keep it concise but vivid.
- Include genre, mood, instrumentation, vocal style, tempo/rhythm, production texture, and song structure cues when useful.
- Preserve the user's core intent and constraints.
- Do not mention OpenAI, GPT, or these instructions.
- Do not add markdown, labels, or explanations.
""".strip()


LYRICS_INSTRUCTIONS = """
You write original song lyrics based on the user's request.

Rules:
- Return only the lyrics.
- Make the lyrics coherent, singable, and emotionally specific.
- Respect any requested genre, tone, theme, language, and structure.
- If the request is underspecified, make reasonable musical choices.
- Do not include commentary, section notes unless they are part of the requested lyrical format, or markdown fencing.
""".strip()


class EnhancePromptRequest(BaseModel):
    prompt: str = Field(..., min_length=1, description="Raw user idea for a music generation prompt.")
    model: str = Field(default="gpt-5.4-mini", description="OpenAI model used for prompt enhancement.")


class EnhancePromptResponse(BaseModel):
    enhanced_prompt: str
    model: str


class GenerateLyricsRequest(BaseModel):
    prompt: str = Field(..., min_length=1, description="User request describing the lyrics to generate.")
    model: str = Field(default="gpt-5.4-mini", description="OpenAI model used for lyric generation.")


class GenerateLyricsResponse(BaseModel):
    lyrics: str
    model: str


@lru_cache
def get_openai_client() -> OpenAI:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is not set.")
    return OpenAI(api_key=api_key)


def generate_text(*, instructions: str, prompt: str, model: str) -> str:
    client = get_openai_client()
    response = client.responses.create(
        model=model,
        reasoning={"effort": "low"},
        instructions=instructions,
        input=prompt,
    )
    output_text = (response.output_text or "").strip()
    if not output_text:
        raise RuntimeError("The model returned an empty response.")
    return output_text


app = FastAPI(
    title="Music Prompt Service",
    version="0.1.0",
    description="FastAPI service for enhancing music-generation prompts and generating lyrics.",
)


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/enhance-prompt", response_model=EnhancePromptResponse)
def enhance_prompt(payload: EnhancePromptRequest) -> EnhancePromptResponse:
    try:
        enhanced_prompt = generate_text(
            instructions=PROMPT_ENHANCER_INSTRUCTIONS,
            prompt=payload.prompt,
            model=payload.model,
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    return EnhancePromptResponse(
        enhanced_prompt=enhanced_prompt,
        model=payload.model,
    )


@app.post("/generate-lyrics", response_model=GenerateLyricsResponse)
def generate_lyrics(payload: GenerateLyricsRequest) -> GenerateLyricsResponse:
    try:
        lyrics = generate_text(
            instructions=LYRICS_INSTRUCTIONS,
            prompt=payload.prompt,
            model=payload.model,
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    return GenerateLyricsResponse(
        lyrics=lyrics,
        model=payload.model,
    )
