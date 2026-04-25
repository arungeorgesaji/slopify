export type CreateOptions = {
  vocalDirection: string
  songType: string
  energy: string
  language: string
  structure: string
  instrumentation: string
  delivery: string
}

export type CreateDraft = {
  id: string
  prompt: string
  enrichedPrompt: string
  lyrics: string
  options: CreateOptions
  createdAt: string
}

const DRAFT_STORAGE_PREFIX = "slopify:create-draft:"

export const DEFAULT_CREATE_OPTIONS: CreateOptions = {
  vocalDirection: "Any lead vocal",
  songType: "Indie pop",
  energy: "Mid energy",
  language: "English",
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

export function loadCreateDraft(draftId: string) {
  const value = sessionStorage.getItem(`${DRAFT_STORAGE_PREFIX}${draftId}`)

  if (!value) {
    return null
  }

  try {
    return JSON.parse(value) as CreateDraft
  } catch {
    return null
  }
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
    `- Structure: ${options.structure}.`,
    `- Instrumentation: ${options.instrumentation}.`,
    `- Vocal delivery: ${options.delivery}.`,
  ].join("\n")
}
