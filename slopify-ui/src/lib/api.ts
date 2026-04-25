export const BACKEND_BASE_URL =
  import.meta.env.VITE_BACKEND_BASE_URL?.trim() ?? ""

export function buildApiUrl(endpoint: string) {
  if (!BACKEND_BASE_URL) {
    return ""
  }

  return `${BACKEND_BASE_URL.replace(/\/+$/, "")}/${endpoint.replace(/^\/+/, "")}`
}
