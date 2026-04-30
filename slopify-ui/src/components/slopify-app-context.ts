import { createContext, useContext } from "react"
import type { Dispatch, SetStateAction } from "react"
import type { Track } from "@/lib/tracks"

type SlopifyPlaybackContextValue = {
  currentTime: number
  currentTrack: Track | null
  isPlaying: boolean
  pauseRequestId: number
  playRequestId: number
  queue: Track[]
  requestPausePlayback: () => void
  requestPlayTrack: (track: Track) => void
  requestSurpriseTrack: () => void
  setCurrentTime: Dispatch<SetStateAction<number>>
  setCurrentTrack: Dispatch<SetStateAction<Track | null>>
  setIsPlaying: Dispatch<SetStateAction<boolean>>
  setQueue: Dispatch<SetStateAction<Track[]>>
  surpriseRequestId: number
}

type SlopifySearchContextValue = {
  search: string
  setSearch: Dispatch<SetStateAction<string>>
}

export const SlopifyPlaybackContext =
  createContext<SlopifyPlaybackContextValue | null>(null)

export const SlopifySearchContext =
  createContext<SlopifySearchContextValue | null>(null)

export function useSlopifyPlayback() {
  const context = useContext(SlopifyPlaybackContext)

  if (context === null) {
    throw new Error("useSlopifyPlayback must be used within SlopifyShell")
  }

  return context
}

export function useSlopifySearch() {
  const context = useContext(SlopifySearchContext)

  if (context === null) {
    throw new Error("useSlopifySearch must be used within SlopifyShell")
  }

  return context
}

export function useSlopifyAppContext() {
  return {
    ...useSlopifyPlayback(),
    ...useSlopifySearch(),
  }
}
