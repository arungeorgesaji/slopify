# Slopify Music API `curl` Reference

Base URL: `https://web-production-4b492.up.railway.app`

## Health

```bash
curl https://web-production-4b492.up.railway.app/healthz
```

## Prompt endpoints

```bash
curl -X POST https://web-production-4b492.up.railway.app/enhance-prompt \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "cinematic indie pop with warm synths and a big chorus",
    "model": "gpt-5.4-mini"
  }'
```

```bash
curl -X POST https://web-production-4b492.up.railway.app/generate-lyrics \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Write melancholic synthwave lyrics about missing the last train home",
    "model": "gpt-5.4-mini"
  }'
```

## Song endpoints

Prompt-based generation:

```bash
curl -X POST https://web-production-4b492.up.railway.app/api/v1/songs/generate \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Midnight Drive",
    "prompt": "neon synthwave instrumental with pulsing bass, gated drums, and a wide cinematic chorus",
    "music_length_ms": 90000,
    "model_id": "music_v1",
    "force_instrumental": true,
    "respect_sections_durations": false,
    "user_id": null
  }'
```

Composition-plan generation:

```bash
curl -X POST https://web-production-4b492.up.railway.app/api/v1/songs/generate \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Sunrise Build",
    "composition_plan": {
      "style": "uplifting progressive house",
      "sections": [
        {
          "name": "intro",
          "duration_ms": 15000,
          "description": "filtered pads and soft kick"
        },
        {
          "name": "drop",
          "duration_ms": 30000,
          "description": "wide supersaws and energetic bass"
        }
      ]
    },
    "music_length_ms": 60000,
    "model_id": "music_v1",
    "respect_sections_durations": true,
    "user_id": null
  }'
```

List songs:

```bash
curl "https://web-production-4b492.up.railway.app/api/v1/songs?limit=20&offset=0"
```

Get one song:

```bash
curl https://web-production-4b492.up.railway.app/api/v1/songs/00000000-0000-0000-0000-000000000000
```

Get song audio:

```bash
curl -L \
  https://web-production-4b492.up.railway.app/api/v1/songs/00000000-0000-0000-0000-000000000000/audio \
  --output song.mp3
```

## Notes

- The backend exposes 7 application endpoints: `GET /healthz`, `POST /enhance-prompt`, `POST /generate-lyrics`, `POST /api/v1/songs/generate`, `GET /api/v1/songs`, `GET /api/v1/songs/{song_id}`, and `GET /api/v1/songs/{song_id}/audio`.
- `POST /api/v1/songs/generate` requires exactly one of `prompt` or `composition_plan`.
- `force_instrumental` is only valid when using `prompt`.
- `GET /api/v1/songs/{song_id}/audio` returns `409` until generation completes and audio is available.
