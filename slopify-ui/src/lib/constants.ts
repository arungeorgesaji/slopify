export const API_ENDPOINTS = {
  enhancePrompt: "/enhance-prompt",
  generateLyrics: "/generate-lyrics",
  songs: "/api/v1/songs",
  generateSong: "/api/v1/songs/generate",
  songById: (songId: string) => `/api/v1/songs/${songId}`,
  songAudio: (songId: string) => `/api/v1/songs/${songId}/audio`,
} as const
