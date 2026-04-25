import { buildApiUrl } from "@/lib/api"
import { API_ENDPOINTS } from "@/lib/constants"

export type Track = {
  id: string
  title: string
  prompt: string
  lyrics: string | null
  vibe: string
  status: string
  duration: string
  dateAdded: string
  audioUrl: string
}

type BackendSong = Record<string, unknown>

export const TOPIC_FILTERS = [
  "situationship debris",
  "villain arc commute",
  "group chat evidence",
  "delulu premium",
  "left on delivered",
  "corporate breakdown",
  "fake deep outro",
  "main character damage",
] as const

const SONGS_URL = buildApiUrl(API_ENDPOINTS.songs)

export async function fetchTracks(): Promise<Track[]> {
  if (!SONGS_URL) {
    return []
  }

  const response = await fetch(`${SONGS_URL}?limit=100&offset=0`)

  if (!response.ok) {
    throw new Error("Failed to fetch songs")
  }

  const payload = (await response.json()) as unknown
  const songs = extractSongs(payload)

  return songs
    .map(mapBackendSongToTrack)
    .filter((track): track is Track => track !== null)
}

function extractSongs(payload: unknown) {
  if (Array.isArray(payload)) {
    return payload.filter(isRecord)
  }

  if (!isRecord(payload)) {
    return []
  }

  for (const candidate of [payload.items, payload.songs, payload.results]) {
    if (Array.isArray(candidate)) {
      return candidate.filter(isRecord)
    }
  }

  return []
}

function mapBackendSongToTrack(song: BackendSong): Track | null {
  const id = firstString(song.id, song.song_id, song.uuid)
  const title = firstString(song.title, song.name)

  if (!id || !title) {
    return null
  }

  const prompt = firstString(song.prompt, song.description)
  const lyrics = firstString(song.lyrics) || null
  const status = firstString(song.status) || "unknown"
  const duration = formatDuration(
    firstNumber(song.music_length_ms, song.duration_ms)
  )
  const dateAdded = formatDate(firstString(song.created_at, song.createdAt))
  const vibe =
    inferVibe(prompt || title) ||
    firstString(song.model_id, song.mime_type, song.status) ||
    "unclassified"

  return {
    id,
    title,
    prompt,
    lyrics,
    vibe,
    status,
    duration,
    dateAdded,
    audioUrl: buildApiUrl(API_ENDPOINTS.songAudio(id)),
  }
}

function inferVibe(text: string) {
  const normalizedText = text.toLowerCase()

  return (
    TOPIC_FILTERS.find((filter) =>
      normalizedText.includes(filter.toLowerCase())
    ) ?? ""
  )
}

function firstString(...values: unknown[]) {
  const value = values.find(
    (candidate): candidate is string =>
      typeof candidate === "string" && candidate.trim().length > 0
  )

  return value?.trim() ?? ""
}

function firstNumber(...values: unknown[]) {
  return (
    values.find(
      (candidate): candidate is number =>
        typeof candidate === "number" && Number.isFinite(candidate)
    ) ?? null
  )
}

function formatDuration(durationMs: number | null) {
  if (durationMs === null || durationMs <= 0) {
    return "--"
  }

  const totalSeconds = Math.round(durationMs / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  return `${minutes}:${String(seconds).padStart(2, "0")}`
}

function formatDate(value: string) {
  if (!value) {
    return "--"
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}
