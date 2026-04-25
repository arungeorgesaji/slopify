export type Track = {
  id: string
  title: string
}

type TrackMeta = {
  dateAdded: string
  duration: string
  vibe: string
}

export const TOPIC_FILTERS = [
  "All",
  "Electronic",
  "High Adrenaline",
  "Fast-Paced",
  "Ambient",
  "Lo-Fi",
  "Cinematic",
  "Acoustic",
] as const

const MOCK_TRACKS: Track[] = [
  { id: "track-001", title: "Liquid AI Sunrise" },
  { id: "track-002", title: "Synth Slop Drive" },
  { id: "track-003", title: "Promptwave Echo" },
  { id: "track-004", title: "Token Funk Parade" },
  { id: "track-005", title: "Neural Pop Skyline" },
  { id: "track-006", title: "Dream Loop Cascade" },
  { id: "track-007", title: "Vector Beat Horizon" },
  { id: "track-008", title: "Machine Groove Bloom" },
  { id: "track-009", title: "Liquid AI Drift" },
  { id: "track-010", title: "Synthetic Midnight Pulse" },
  { id: "track-011", title: "Lo-Fi Model Mirage" },
  { id: "track-012", title: "Algorithm Avenue" },
] as const

export const DEFAULT_TRACK = MOCK_TRACKS[0]

export const PLACEHOLDER_LYRICS = `Verse 1
Streaming soft across the white-blue glow,
Machine-made melodies begin to flow.
Signals hum beneath the glassy light,
Slopify keeps looping through the night.

Chorus
Press play and let the prompts align,
Every broken phrase turns out divine.
We drift where the synthetic colors fly,
Inside the feed, inside Slopify.

Verse 2
Tokens fall like rain on silent keys,
Tiny sparks arranged in harmonies.
Rhythms pulse through circuits in disguise,
Half-dreamed hooks and chrome-lit lullabies.

Bridge
No faces, no frames, just words in motion,
Floating through a pixel ocean.
Hold the line and let the waveform rise,
Static turns to sound before your eyes.`

export async function fetchTracks(): Promise<Track[]> {
  await new Promise((resolve) => window.setTimeout(resolve, 150))
  return [...MOCK_TRACKS]
}

export function fakeDurationForTrack(trackId: string) {
  return getTrackMeta(trackId).duration
}

export function fakeDateAddedForTrack(trackId: string) {
  return getTrackMeta(trackId).dateAdded
}

export function fakeVibeForTrack(trackId: string) {
  return getTrackMeta(trackId).vibe
}

function getTrackMeta(trackId: string): TrackMeta {
  const index = MOCK_TRACKS.findIndex((track) => track.id === trackId)
  const normalizedIndex = index === -1 ? 0 : index
  const minutes = 2 + (normalizedIndex % 3)
  const seconds = (normalizedIndex * 17 + 12) % 60
  const month = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"][
    normalizedIndex % 6
  ]
  const day = 4 + normalizedIndex * 2
  const vibe = [
    "Electronic",
    "Fast-Paced",
    "Cinematic",
    "High Adrenaline",
    "Ambient",
    "Lo-Fi",
    "Acoustic",
    "Electronic",
    "Cinematic",
    "High Adrenaline",
    "Lo-Fi",
    "Ambient",
  ][normalizedIndex]

  return {
    dateAdded: `${month} ${day}, 2026`,
    duration: `${minutes}:${String(seconds).padStart(2, "0")}`,
    vibe,
  }
}
