# Music Prompt Service

FastAPI service with two OpenAI-backed endpoints:

- `POST /enhance-prompt` enhances a music prompt for downstream ElevenLabs music generation.
- `POST /generate-lyrics` generates song lyrics from a user prompt.

## Setup

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

Set `OPENAI_API_KEY` in `.env` or your shell environment.

## Run

```bash
uvicorn app.main:app --reload
```

## Example requests

```bash
curl -X POST http://127.0.0.1:8000/enhance-prompt \
  -H "Content-Type: application/json" \
  -d '{"prompt":"make a dark cinematic trap song about revenge"}'
```

```bash
curl -X POST http://127.0.0.1:8000/generate-lyrics \
  -H "Content-Type: application/json" \
  -d '{"prompt":"Write melancholic indie-pop lyrics about missing someone after moving cities"}'
```
