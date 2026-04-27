import { createContext, useContext } from "react"
import type { Dispatch, SetStateAction } from "react"
import type { Track } from "@/lib/tracks"

type SlopifyPlaybackContextValue = {
  currentTrack: Track | null
  queue: Track[]
  setCurrentTrack: Dispatch<SetStateAction<Track | null>>
  setQueue: Dispatch<SetStateAction<Track[]>>
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
