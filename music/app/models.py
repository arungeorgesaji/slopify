from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field, model_validator


class SongGenerateRequest(BaseModel):
    title: str | None = Field(default=None, max_length=200)
    prompt: str | None = Field(default=None, min_length=3, max_length=2000)
    composition_plan: dict[str, Any] | None = None
    music_length_ms: int | None = Field(default=None, ge=3000, le=600000)
    model_id: str = Field(default="music_v1", max_length=100)
    force_instrumental: bool = False
    respect_sections_durations: bool = False
    user_id: UUID | None = None

    @model_validator(mode="after")
    def validate_generation_source(self) -> "SongGenerateRequest":
        if bool(self.prompt) == bool(self.composition_plan):
            raise ValueError("Provide exactly one of `prompt` or `composition_plan`.")
        if self.force_instrumental and self.composition_plan is not None:
            raise ValueError(
                "`force_instrumental` is only supported when generating from `prompt`."
            )
        return self


class EnhancePromptRequest(BaseModel):
    prompt: str = Field(
        ...,
        min_length=1,
        description="Raw user idea for a music generation prompt.",
    )
    model: str = Field(
        default="gpt-5.4-mini",
        description="OpenAI model used for prompt enhancement.",
    )


class EnhancePromptResponse(BaseModel):
    enhanced_prompt: str
    model: str


class GenerateLyricsRequest(BaseModel):
    prompt: str = Field(
        ...,
        min_length=1,
        description="User request describing the lyrics to generate.",
    )
    model: str = Field(
        default="gpt-5.4-mini",
        description="OpenAI model used for lyric generation.",
    )


class GenerateLyricsResponse(BaseModel):
    lyrics: str
    model: str


class SongRecord(BaseModel):
    id: UUID
    user_id: UUID | None = None
    title: str | None = None
    prompt: str | None = None
    composition_plan: dict[str, Any] | None = None
    model_id: str
    music_length_ms: int | None = None
    force_instrumental: bool
    respect_sections_durations: bool
    status: str
    storage_bucket: str
    storage_path: str | None = None
    mime_type: str | None = None
    size_bytes: int | None = None
    error_message: str | None = None
    created_at: datetime
    updated_at: datetime


class SongListResponse(BaseModel):
    items: list[SongRecord]
    total: int


class HealthResponse(BaseModel):
    status: str = "ok"
