export const OPENAI_API_KEY_HEADER = "x-openai-api-key"
export const ELEVENLABS_API_KEY_HEADER = "x-elevenlabs-api-key"

const STORAGE_KEY = "slopify.providerKeys"

export type ProviderKeys = {
  elevenLabsApiKey: string
  openAIApiKey: string
}

const EMPTY_PROVIDER_KEYS: ProviderKeys = {
  elevenLabsApiKey: "",
  openAIApiKey: "",
}

export function getStoredProviderKeys(): ProviderKeys {
  if (typeof window === "undefined") {
    return EMPTY_PROVIDER_KEYS
  }

  try {
    const rawValue = window.localStorage.getItem(STORAGE_KEY)
    if (!rawValue) {
      return EMPTY_PROVIDER_KEYS
    }

    const parsed = JSON.parse(rawValue) as Partial<ProviderKeys>
    return {
      elevenLabsApiKey: normalizeKey(parsed.elevenLabsApiKey),
      openAIApiKey: normalizeKey(parsed.openAIApiKey),
    }
  } catch {
    return EMPTY_PROVIDER_KEYS
  }
}

export function saveProviderKeys(keys: ProviderKeys) {
  if (typeof window === "undefined") {
    return
  }

  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      elevenLabsApiKey: normalizeKey(keys.elevenLabsApiKey),
      openAIApiKey: normalizeKey(keys.openAIApiKey),
    })
  )
}

export function clearProviderKeys() {
  if (typeof window === "undefined") {
    return
  }

  window.localStorage.removeItem(STORAGE_KEY)
}

export function hasRequiredGenerationKeys(keys: ProviderKeys) {
  return Boolean(keys.elevenLabsApiKey && keys.openAIApiKey)
}

export function buildGenerationHeaders(
  initHeaders: HeadersInit = {}
): Headers {
  const headers = new Headers(initHeaders)
  const keys = getStoredProviderKeys()

  if (keys.openAIApiKey) {
    headers.set(OPENAI_API_KEY_HEADER, keys.openAIApiKey)
  }

  if (keys.elevenLabsApiKey) {
    headers.set(ELEVENLABS_API_KEY_HEADER, keys.elevenLabsApiKey)
  }

  return headers
}

function normalizeKey(value: string | undefined) {
  return typeof value === "string" ? value.trim() : ""
}
