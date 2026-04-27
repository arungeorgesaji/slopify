import { buildApiUrl } from "@/lib/api"
import { API_ENDPOINTS } from "@/lib/constants"

export type Track = {
  id: string
  sourceId: string
  sourceKind: "song" | "session-variant"
  title: string
  prompt: string
  lyrics: string | null
  vibe: string
  status: string
  duration: string
  dateAdded: string
  audioUrl: string
  coverUrl: string
  videoJobId: string
  videoStatus: string
  videoUrl: string
  videoError: string
  variationLabel: string
}

type BackendSong = Record<string, unknown>

const SONGS_URL = buildApiUrl(API_ENDPOINTS.songs)
const SONG_SESSIONS_URL = buildApiUrl(API_ENDPOINTS.songSessions)

export async function fetchTracks(): Promise<Track[]> {
  if (!hasSongsBackend()) {
    return []
  }

  const [songTracks, selectedSessionTracks] = await Promise.all([
    fetchSongTracks(),
    fetchSelectedSessionTracks(),
  ])

  return dedupeTracks([...selectedSessionTracks, ...songTracks])
}

export async function refreshTrack(track: Pick<Track, "sourceId" | "sourceKind">) {
  if (track.sourceKind === "song") {
    return fetchSongTrack(track.sourceId)
  }

  return fetchSelectedSessionTrackByVariantId(track.sourceId)
}

async function fetchSongTracks(): Promise<Track[]> {
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

async function fetchSongTrack(songId: string): Promise<Track | null> {
  const url = buildApiUrl(API_ENDPOINTS.songById(songId))

  if (!url) {
    throw new Error("Backend URL is missing")
  }

  const response = await fetch(url)

  if (!response.ok) {
    throw new Error("Failed to fetch song")
  }

  const payload = (await response.json()) as unknown

  if (!isRecord(payload)) {
    throw new Error("Song response was invalid")
  }

  return mapBackendSongToTrack(payload, { audioKind: "song" })
}

async function fetchSelectedSessionTracks(): Promise<Track[]> {
  if (!SONG_SESSIONS_URL) {
    return []
  }

  const response = await fetch(`${SONG_SESSIONS_URL}?limit=100&offset=0`)

  if (!response.ok) {
    throw new Error("Failed to fetch song sessions")
  }

  const payload = (await response.json()) as unknown
  const sessions = extractSongs(payload).filter((session) =>
    firstString(session.selected_variant_id, session.selectedVariantId)
  )
  const sessionIds = sessions
    .map((session) => firstString(session.id, session.session_id, session.uuid))
    .filter(Boolean)

  const sessionDetails = await Promise.allSettled(
    sessionIds.map((sessionId) => fetchSongSessionDetail(sessionId))
  )

  return sessionDetails
    .flatMap((result) => (result.status === "fulfilled" ? [result.value] : []))
    .map(mapSelectedSessionVariantToTrack)
    .filter((track): track is Track => track !== null)
}

async function fetchSongSessionDetail(sessionId: string) {
  const url = buildApiUrl(API_ENDPOINTS.songSessionById(sessionId))

  if (!url) {
    throw new Error("Backend URL is missing")
  }

  const response = await fetch(url)

  if (!response.ok) {
    throw new Error("Failed to fetch song session detail")
  }

  const payload = (await response.json()) as unknown

  if (!isRecord(payload)) {
    throw new Error("Song session response was invalid")
  }

  return payload
}

async function fetchSelectedSessionTrackByVariantId(
  variantId: string
): Promise<Track | null> {
  if (!SONG_SESSIONS_URL) {
    return null
  }

  const response = await fetch(`${SONG_SESSIONS_URL}?limit=100&offset=0`)

  if (!response.ok) {
    throw new Error("Failed to fetch song sessions")
  }

  const payload = (await response.json()) as unknown
  const sessions = extractSongs(payload).filter((session) => {
    return (
      firstString(session.selected_variant_id, session.selectedVariantId) ===
      variantId
    )
  })
  const sessionId = firstString(
    sessions[0]?.id,
    sessions[0]?.session_id,
    sessions[0]?.uuid
  )

  if (!sessionId) {
    return null
  }

  const detail = await fetchSongSessionDetail(sessionId)
  return mapSelectedSessionVariantToTrack(detail)
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
    return [mapBackendSongToTrack(song, { audioKind: "song" })]
  }

  return variations.map((variation, index) =>
    mapBackendSongToTrack(
      { ...song, ...variation },
      {
        audioKind: "song",
        includeVariationInId: true,
        variationIndex: index + 1,
      }
    )
  )
}

function mapSelectedSessionVariantToTrack(session: BackendSong): Track | null {
  const selectedVariantId = firstString(
    session.selected_variant_id,
    session.selectedVariantId
  )
  const sessionId = firstString(session.id, session.session_id, session.uuid)

  if (!selectedVariantId || !sessionId) {
    return null
  }

  const selectedVariant = extractVariations(session).find(
    (variant) =>
      firstString(variant.id, variant.variant_id) === selectedVariantId
  )

  if (!selectedVariant) {
    return null
  }

  const variationIndex = firstNumber(selectedVariant.variant_index)

  return mapBackendSongToTrack(
    { ...session, ...selectedVariant },
    {
      audioKind: "variant",
      includeVariationInId: false,
      variationIndex: variationIndex ?? undefined,
      coverRecordId: sessionId,
    }
  )
}

function mapBackendSongToTrack(
  song: BackendSong,
  options: {
    audioKind: "song" | "variant"
    includeVariationInId?: boolean
    variationIndex?: number
    coverRecordId?: string
  }
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
    (options.variationIndex ? `Variation ${options.variationIndex}` : "")
  const trackId =
    options.includeVariationInId && options.variationIndex
      ? `${id}-${options.variationIndex}`
      : id

  return {
    id: trackId,
    sourceId: id,
    sourceKind: options.audioKind === "variant" ? "session-variant" : "song",
    title: variationLabel ? `${title} (${variationLabel})` : title,
    prompt,
    lyrics,
    vibe,
    status,
    duration,
    dateAdded,
    audioUrl: getAudioUrl(song, id, options.audioKind),
    coverUrl: getCoverUrl(
      song,
      options.coverRecordId ?? id,
      options.audioKind
    ),
    videoJobId: firstString(song.video_job_id, song.videoJobId),
    videoStatus: firstString(song.video_status, song.videoStatus),
    videoUrl: firstString(song.video_url, song.videoUrl),
    videoError: firstString(song.video_error, song.videoError),
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

function getAudioUrl(
  song: BackendSong,
  recordId: string,
  audioKind: "song" | "variant"
) {
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

  return buildApiUrl(
    audioKind === "variant"
      ? API_ENDPOINTS.songVariantAudio(recordId)
      : API_ENDPOINTS.songAudio(recordId)
  )
}

function getCoverUrl(
  song: BackendSong,
  recordId: string,
  audioKind: "song" | "variant"
) {
  const directUrl = firstString(
    song.image_url,
    song.imageUrl,
    song.cover_url,
    song.coverUrl,
    song.artwork_url,
    song.artworkUrl,
    song.image_public_url,
    song.imagePublicUrl,
    song.image_signed_url,
    song.imageSignedUrl
  )

  if (directUrl) {
    return directUrl
  }

  const hasStoredImage = Boolean(
    firstString(
      song.image_storage_path,
      song.imageStoragePath,
      song.cover_path,
      song.coverPath
    ) &&
      firstString(song.image_mime_type, song.imageMimeType, song.cover_mime_type)
  )

  if (!hasStoredImage) {
    return ""
  }

  return buildApiUrl(
    audioKind === "variant"
      ? API_ENDPOINTS.songSessionImage(recordId)
      : API_ENDPOINTS.songImage(recordId)
  )
}

function dedupeTracks(tracks: Track[]) {
  const seenTrackIds = new Set<string>()

  return tracks.filter((track) => {
    if (seenTrackIds.has(track.id)) {
      return false
    }

    seenTrackIds.add(track.id)
    return true
  })
}

function firstString(...values: unknown[]) {
  const value = values.find(
    (candidate): candidate is string =>
      typeof candidate === "string" && candidate.trim().length > 0
  )

  return value?.trim() ?? ""
}

function firstNumber(...values: unknown[]) {
  for (const candidate of values) {
    if (typeof candidate === "number" && Number.isFinite(candidate)) {
      return candidate
    }

    if (typeof candidate === "string") {
      const parsed = Number(candidate)

      if (Number.isFinite(parsed)) {
        return parsed
      }
    }
  }

  return null
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

function hasSongsBackend() {
  return Boolean(SONGS_URL || SONG_SESSIONS_URL)
}
