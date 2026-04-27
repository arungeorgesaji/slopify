from functools import lru_cache

from pydantic import Field
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "slopify-music-api"
    api_prefix: str = "/api/v1"
    elevenlabs_api_key: str = Field(..., alias="ELEVENLABS_API_KEY")
    elevenlabs_base_url: str = Field(
        default="https://api.elevenlabs.io",
        alias="ELEVENLABS_BASE_URL",
    )
    openai_api_key: str | None = Field(default=None, alias="OPENAI_API_KEY")
    supabase_url: str = Field(..., alias="SUPABASE_URL")
    supabase_service_role_key: str = Field(..., alias="SUPABASE_SERVICE_ROLE_KEY")
    supabase_storage_bucket: str = Field(
        default="generated-music",
        alias="SUPABASE_STORAGE_BUCKET",
    )
    supabase_image_storage_bucket: str = Field(
        default="generated-images",
        alias="SUPABASE_IMAGE_STORAGE_BUCKET",
    )
    cors_allow_origins: list[str] = Field(
        default_factory=lambda: [
            "http://localhost:5173",
            "http://localhost:5174",
        ],
        alias="CORS_ALLOW_ORIGINS",
    )

    @field_validator("cors_allow_origins", mode="before")
    @classmethod
    def parse_cors_allow_origins(cls, value: str | list[str]) -> list[str]:
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
