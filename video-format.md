# 🎬 Video Generation API Specification

This document defines the request and response structure for the Video Generation API, along with how assets are stored in Supabase.

---

## 📥 Request Parameters

The API accepts a JSON payload with the following fields:

| Field | Type | Required | Description |
|------|------|---------|-------------|
| `id` | `uuid` | ❌ | Unique identifier for the song/video (auto-generated if not provided) |
| `title` | `text` | ❌ | Title of the song/video |
| `lyrics` | `text` | ❌ | Lyrics used for generating the video |

---

## 📤 Response Format

### Immediate Response (Async Job Start)

```json
{
  "success": true
}
