from fastapi import FastAPI

from app.config import get_settings
from app.models import HealthResponse
from app.routes.songs import router as songs_router

settings = get_settings()
app = FastAPI(title=settings.app_name)
app.include_router(songs_router, prefix=settings.api_prefix)


@app.get("/healthz", response_model=HealthResponse, tags=["health"])
def healthcheck() -> HealthResponse:
    return HealthResponse()
