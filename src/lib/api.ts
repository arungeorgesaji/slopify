const rawBackendBaseUrl = import.meta.env.VITE_BACKEND_BASE_URL?.trim() ?? ""

export const BACKEND_BASE_URL = normalizeBackendBaseUrl(rawBackendBaseUrl)

export function buildApiUrl(endpoint: string) {
  if (!BACKEND_BASE_URL) {
    return ""
  }

  return `${BACKEND_BASE_URL.replace(/\/+$/, "")}/${endpoint.replace(/^\/+/, "")}`
}

function normalizeBackendBaseUrl(value: string) {
  if (!value) {
    return ""
  }

  if (/^https?:\/\//i.test(value)) {
    return value
  }

  return `https://${value}`
}
