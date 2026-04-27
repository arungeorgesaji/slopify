export type CreateOptions = {
  vocalDirection: string
  songType: string
  energy: string
  language: string
  durationMs: number
  structure: string
  instrumentation: string
  delivery: string
}

export type CreateDraft = {
  id: string
  prompt: string
  enrichedPrompt: string
  lyrics: string
  coverImageBase64: string | null
  coverImageMimeType: string | null
  options: CreateOptions
  createdAt: string
}

const DRAFT_STORAGE_PREFIX = "slopify:create-draft:"
const SESSION_DRAFT_STORAGE_PREFIX = "slopify:create-session-draft:"

export const DEFAULT_CREATE_OPTIONS: CreateOptions = {
  vocalDirection: "Any lead vocal",
  songType: "Indie pop",
  energy: "Mid energy",
  language: "English",
  durationMs: 10000,
  structure: "Verse chorus",
  instrumentation: "Full band and synths",
  delivery: "Sung vocals",
}

export const VOCAL_DIRECTION_OPTIONS = [
  "Any lead vocal",
  "Female lead vocal",
  "Male lead vocal",
  "Duet vocals",
] as const

export const SONG_TYPE_OPTIONS = [
  "Indie pop",
  "Hip-hop",
  "Synthwave",
  "EDM",
  "Rock",
  "Lo-fi",
] as const

export const ENERGY_OPTIONS = [
  "Chill",
  "Mid energy",
  "High energy",
  "Anthemic",
] as const

export const LANGUAGE_OPTIONS = [
  "English",
  "Hindi",
  "Malayalam",
  "Spanish",
  "German",
  "Japanese",
  "Portuguese",
  "Italian",
  "Finnish",
  "Greek",
] as const

export const STRUCTURE_OPTIONS = [
  "Verse chorus",
  "Hook first",
  "Slow build",
  "Cinematic arc",
] as const

export const INSTRUMENTATION_OPTIONS = [
  "Full band and synths",
  "Electronic production",
  "Guitar driven",
  "Piano led",
  "Minimal lo-fi",
] as const

export const DELIVERY_OPTIONS = [
  "Sung vocals",
  "Rap verse",
  "Spoken hook",
  "Choir layers",
] as const

export const CREATE_DURATION_MIN_MS = 10000
export const CREATE_DURATION_MAX_MS = 60000
export const CREATE_DURATION_STEP_MS = 5000

export function createDraftId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID()
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function saveCreateDraft(draft: CreateDraft) {
  sessionStorage.setItem(
    `${DRAFT_STORAGE_PREFIX}${draft.id}`,
    JSON.stringify(draft)
  )
}

export function clearCreateDraft(draftId: string) {
  sessionStorage.removeItem(`${DRAFT_STORAGE_PREFIX}${draftId}`)
}

export function loadCreateDraft(draftId: string) {
  const value = sessionStorage.getItem(`${DRAFT_STORAGE_PREFIX}${draftId}`)

  if (!value) {
    return null
  }

  try {
    const draft = JSON.parse(value) as Partial<CreateDraft>

    if (
      !draft ||
      typeof draft.id !== "string" ||
      typeof draft.prompt !== "string" ||
      typeof draft.enrichedPrompt !== "string" ||
      typeof draft.lyrics !== "string" ||
      typeof draft.createdAt !== "string"
    ) {
      return null
    }

    return {
      id: draft.id,
      prompt: draft.prompt,
      enrichedPrompt: draft.enrichedPrompt,
      lyrics: draft.lyrics,
      coverImageBase64:
        typeof draft.coverImageBase64 === "string" ? draft.coverImageBase64 : null,
      coverImageMimeType:
        typeof draft.coverImageMimeType === "string"
          ? draft.coverImageMimeType
          : null,
      createdAt: draft.createdAt,
      options: {
        ...DEFAULT_CREATE_OPTIONS,
        ...(draft.options ?? {}),
      },
    }
  } catch {
    return null
  }
}

export function linkSessionToDraft(sessionId: string, draftId: string) {
  sessionStorage.setItem(`${SESSION_DRAFT_STORAGE_PREFIX}${sessionId}`, draftId)
}

export function loadDraftIdForSession(sessionId: string) {
  return sessionStorage.getItem(`${SESSION_DRAFT_STORAGE_PREFIX}${sessionId}`)
}

export function clearSessionDraftLink(sessionId: string) {
  sessionStorage.removeItem(`${SESSION_DRAFT_STORAGE_PREFIX}${sessionId}`)
}

export function buildMusicPrompt(prompt: string, options: CreateOptions) {
  return [
    prompt.trim(),
    "",
    "Song direction:",
    `- Vocal direction: ${options.vocalDirection}.`,
    `- Song type: ${options.songType}.`,
    `- Energy: ${options.energy}.`,
    `- Language: ${options.language}.`,
    `- Duration: ${formatCreateDuration(options.durationMs)}.`,
    `- Structure: ${options.structure}.`,
    `- Instrumentation: ${options.instrumentation}.`,
    `- Vocal delivery: ${options.delivery}.`,
  ].join("\n")
}

export function formatCreateDuration(durationMs: number) {
  const totalSeconds = Math.round(durationMs / 1000)

  if (totalSeconds < 60) {
    return `${totalSeconds}s`
  }

  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  if (seconds === 0) {
    return `${minutes} min`
  }

  return `${minutes}m ${seconds}s`
}
