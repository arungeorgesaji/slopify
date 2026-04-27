# lyrics-to-album-video-service

Node.js + TypeScript microservice that converts lyrics and metadata into a unique album video output. It does not generate music.

Flow:

Main Backend -> lyrics-to-album-video-service -> GPT-4.1 prompt generation -> OpenAI Sora video generation -> Supabase Storage URL

## Environment

```bash
OPENAI_API_KEY=
CHAT_MODEL=gpt-4.1
VIDEO_MODEL=sora-2
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_STORAGE_BUCKET=videos
PORT=3000
```

## Endpoints

- `GET /health`
- `POST /album-video/generate`
- `GET /album-video/status/:jobId`
- `GET /album-video/video/:providerJobId`

`POST /album-video/generate` accepts `{ id?, title?, lyrics? }`, starts the generation job in the background, and immediately returns:

```json
{
  "success": true
}
```

Use `GET /album-video/status/:jobId` to poll queued or processing Sora jobs. When complete, it downloads Sora content, uploads it to `SUPABASE_STORAGE_BUCKET`, and returns the final URL. If Supabase is not configured, the service returns a local proxy URL for Sora content.
