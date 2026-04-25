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
  variationLabel: string
}

type BackendSong = Record<string, unknown>

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
    .flatMap(mapBackendSongToTracks)
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

function mapBackendSongToTracks(song: BackendSong): Array<Track | null> {
  const variations = extractVariations(song)

  if (variations.length === 0) {
    return [mapBackendSongToTrack(song)]
  }

  return variations.map((variation, index) =>
    mapBackendSongToTrack({ ...song, ...variation }, index + 1)
  )
}

function mapBackendSongToTrack(
  song: BackendSong,
  variationIndex?: number
): Track | null {
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
    firstString(song.genre, song.style, song.mood, song.vibe, song.status) ||
    "unknown"
  const variationLabel =
    firstString(song.variation, song.variant, song.version, song.label) ||
    (variationIndex ? `Variation ${variationIndex}` : "")

  return {
    id: variationIndex ? `${id}-${variationIndex}` : id,
    title: variationLabel ? `${title} (${variationLabel})` : title,
    prompt,
    lyrics,
    vibe,
    status,
    duration,
    dateAdded,
    audioUrl: getAudioUrl(song, id),
    variationLabel,
  }
}

function extractVariations(song: BackendSong) {
  for (const candidate of [
    song.variations,
    song.variants,
    song.outputs,
    song.files,
    song.tracks,
    song.generated_songs,
  ]) {
    if (Array.isArray(candidate)) {
      return candidate.filter(isRecord)
    }
  }

  return []
}

function getAudioUrl(song: BackendSong, songId: string) {
  const directUrl = firstString(
    song.audio_url,
    song.audioUrl,
    song.music_url,
    song.musicUrl,
    song.file_url,
    song.fileUrl,
    song.public_url,
    song.publicUrl,
    song.signed_url,
    song.signedUrl,
    song.supabase_url,
    song.supabaseUrl,
    song.url
  )

  if (directUrl) {
    return directUrl
  }

  for (const nestedKey of [
    "audio",
    "music_file",
    "musicFile",
    "file",
    "storage",
  ]) {
    const nestedValue = song[nestedKey]

    if (!isRecord(nestedValue)) {
      continue
    }

    const nestedUrl = firstString(
      nestedValue.audio_url,
      nestedValue.audioUrl,
      nestedValue.music_url,
      nestedValue.musicUrl,
      nestedValue.file_url,
      nestedValue.fileUrl,
      nestedValue.public_url,
      nestedValue.publicUrl,
      nestedValue.signed_url,
      nestedValue.signedUrl,
      nestedValue.supabase_url,
      nestedValue.supabaseUrl,
      nestedValue.url
    )

    if (nestedUrl) {
      return nestedUrl
    }
  }

  return buildApiUrl(API_ENDPOINTS.songAudio(songId))
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
