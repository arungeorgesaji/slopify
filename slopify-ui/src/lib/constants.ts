export const API_ENDPOINTS = {
  enhancePrompt: "/enhance-prompt",
  generateLyrics: "/generate-lyrics",
  songs: "/api/v1/songs",
  generateSong: "/api/v1/songs/generate",
  songSessions: "/api/v1/songs/sessions",
  generateSongSession: "/api/v1/songs/sessions/generate",
  songById: (songId: string) => `/api/v1/songs/${songId}`,
  songAudio: (songId: string) => `/api/v1/songs/${songId}/audio`,
  songSessionById: (sessionId: string) => `/api/v1/songs/sessions/${sessionId}`,
  selectSongVariant: (sessionId: string, variantId: string) =>
    `/api/v1/songs/sessions/${sessionId}/select/${variantId}`,
  songVariantAudio: (variantId: string) =>
    `/api/v1/songs/variants/${variantId}/audio`,
} as const
