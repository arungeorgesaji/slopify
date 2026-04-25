import { buildApiUrl } from "@/lib/api"
import { API_ENDPOINTS } from "@/lib/constants"

export const MAX_PROMPT_LENGTH = 2000
export const VARIANT_COUNT = 2
export const SONG_DURATION_MS = 10000

export type SongVariantRecord = Record<string, unknown> & {
  id: string
  variant_index?: number
  title?: string | null
  prompt?: string | null
  lyrics?: string | null
  status?: string | null
  storage_path?: string | null
  mime_type?: string | null
  music_length_ms?: number | null
  error_message?: string | null
}

export type SongSessionDetail = Record<string, unknown> & {
  id: string
  title?: string | null
  prompt?: string | null
  lyrics?: string | null
  selected_variant_id?: string | null
  variants: SongVariantRecord[]
}

export async function generateSongSession({
  prompt,
  lyrics,
}: {
  prompt: string
  lyrics: string
}): Promise<SongSessionDetail> {
  const url = buildApiUrl(API_ENDPOINTS.generateSongSession)

  if (!url) {
    throw new Error("Backend URL is missing")
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      title: deriveTitle(prompt),
      prompt,
      lyrics,
      music_length_ms: SONG_DURATION_MS,
      model_id: "music_v1",
      force_instrumental: false,
      respect_sections_durations: false,
      candidate_count: VARIANT_COUNT,
      user_id: null,
    }),
  })

  if (!response.ok) {
    throw new Error(await readApiError(response))
  }

  const payload = (await response.json()) as unknown

  if (!isSongSessionDetail(payload)) {
    throw new Error("Generation response did not include song variations")
  }

  return payload
}

export async function generateLyrics(prompt: string) {
  const url = buildApiUrl(API_ENDPOINTS.generateLyrics)

  if (!url) {
    throw new Error("Backend URL is missing")
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      prompt,
    }),
  })

  if (!response.ok) {
    throw new Error(await readApiError(response))
  }

  const payload = (await response.json()) as unknown

  if (!isRecord(payload)) {
    throw new Error("Lyrics response was invalid")
  }

  const lyrics = firstString(payload.lyrics, payload.text, payload.result)

  if (!lyrics) {
    throw new Error("Lyrics response was empty")
  }

  return lyrics
}

export async function fetchSongSession(
  sessionId: string
): Promise<SongSessionDetail> {
  const url = buildApiUrl(API_ENDPOINTS.songSessionById(sessionId))

  if (!url) {
    throw new Error("Backend URL is missing")
  }

  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(await readApiError(response))
  }

  const payload = (await response.json()) as unknown

  if (!isSongSessionDetail(payload)) {
    throw new Error("Session response did not include song variations")
  }

  return payload
}

export async function selectSongVariant(
  sessionId: string,
  variantId: string
): Promise<SongSessionDetail> {
  const url = buildApiUrl(API_ENDPOINTS.selectSongVariant(sessionId, variantId))

  if (!url) {
    throw new Error("Backend URL is missing")
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/json",
    },
  })

  if (!response.ok) {
    throw new Error(await readApiError(response))
  }

  const payload = (await response.json()) as unknown

  if (!isRecord(payload) || !isSongSessionDetail(payload.session)) {
    throw new Error("Approval response did not include the updated session")
  }

  return payload.session
}

export function sortSongVariants(variants: SongVariantRecord[]) {
  return [...variants].sort(
    (left, right) => getVariantIndex(left) - getVariantIndex(right)
  )
}

export function isCompletedVariant(variant: SongVariantRecord) {
  return firstString(variant.status).toLowerCase() === "completed"
}

export function hasVariantAudio(variant: SongVariantRecord) {
  return Boolean(
    getDirectAudioUrl(variant) ||
    (firstString(variant.storage_path, variant.storagePath) &&
      firstString(variant.mime_type, variant.mimeType))
  )
}

export function getVariantAudioUrl(variant: SongVariantRecord) {
  const directUrl = getDirectAudioUrl(variant)

  if (directUrl) {
    return directUrl
  }

  return buildApiUrl(API_ENDPOINTS.songVariantAudio(variant.id))
}

export function getVariantIndex(variant: SongVariantRecord) {
  return firstNumber(variant.variant_index, variant.variantIndex) ?? 1
}

export function getVariantLyrics(
  session: SongSessionDetail,
  variant: SongVariantRecord
) {
  return firstString(
    variant.lyrics,
    session.lyrics,
    variant.prompt,
    session.prompt
  )
}

export function formatDuration(durationMs: number | null) {
  if (durationMs === null || durationMs <= 0) {
    return "--"
  }

  const totalSeconds = Math.round(durationMs / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  return `${minutes}:${String(seconds).padStart(2, "0")}`
}

export function firstString(...values: unknown[]) {
  const value = values.find(
    (candidate): candidate is string =>
      typeof candidate === "string" && candidate.trim().length > 0
  )

  return value?.trim() ?? ""
}

export function firstNumber(...values: unknown[]) {
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

export async function readApiError(response: Response) {
  const responseText = await response.text()

  if (!responseText) {
    return `HTTP ${response.status}`
  }

  try {
    const payload = JSON.parse(responseText) as unknown
    const detail = extractErrorDetail(payload)

    if (detail) {
      return `HTTP ${response.status}: ${detail}`
    }
  } catch {
    return `HTTP ${response.status}: ${responseText.slice(0, 180)}`
  }

  return `HTTP ${response.status}: ${responseText.slice(0, 180)}`
}

function deriveTitle(prompt: string) {
  const words = prompt
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .filter(Boolean)
    .slice(0, 5)

  if (words.length === 0) {
    return "Untitled Signal"
  }

  return (
    words
      .join(" ")
      .replace(/[^\w\s'-]/g, "")
      .trim() || "Untitled Signal"
  )
}

function extractErrorDetail(payload: unknown) {
  if (!isRecord(payload)) {
    return ""
  }

  const detail = payload.detail

  if (typeof detail === "string") {
    return detail
  }

  if (Array.isArray(detail)) {
    return detail
      .map((item) =>
        isRecord(item) && typeof item.msg === "string" ? item.msg : ""
      )
      .filter(Boolean)
      .join("; ")
  }

  if (isRecord(detail)) {
    return firstString(detail.message, detail.provider_error)
  }

  return firstString(payload.message, payload.error)
}

function getDirectAudioUrl(record: Record<string, unknown>) {
  const directUrl = firstString(
    record.audio_url,
    record.audioUrl,
    record.music_url,
    record.musicUrl,
    record.file_url,
    record.fileUrl,
    record.public_url,
    record.publicUrl,
    record.signed_url,
    record.signedUrl,
    record.supabase_url,
    record.supabaseUrl,
    record.url
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
    const nestedValue = record[nestedKey]

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

  return ""
}

function isSongSessionDetail(value: unknown): value is SongSessionDetail {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    Array.isArray(value.variants)
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}
