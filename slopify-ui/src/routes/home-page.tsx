import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { ArrowLeft, Pause, Play } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  useSlopifyPlayback,
  useSlopifySearch,
} from "@/components/slopify-app-context"
import { fetchTracks, type Track } from "@/lib/tracks"

const EMPTY_EQUALIZER_BARS = Array.from({ length: 16 }, (_, index) => ({
  id: index,
  animationDelay: `${index * 0.05}s`,
  height: `${36 + (index % 8) * 18}px`,
}))
const SKELETON_ROWS = Array.from({ length: 6 }, (_, index) => index)

export function HomePage() {
  const {
    currentTime,
    currentTrack,
    isPlaying,
    requestPausePlayback,
    requestPlayTrack,
    setCurrentTrack,
    setQueue,
    surpriseRequestId,
  } = useSlopifyPlayback()
  const { search } = useSlopifySearch()
  const deferredSearch = useDeferredValue(search)
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null)
  const previousCurrentTrackIdRef = useRef<string | null>(null)
  const handledSurpriseRequestIdRef = useRef(0)
  const videoRef = useRef<HTMLVideoElement | null>(null)

  const { data: tracks = [], isLoading } = useQuery({
    queryKey: ["tracks"],
    queryFn: fetchTracks,
    staleTime: 20_000,
    refetchInterval: (query) => {
      const items = (query.state.data as Track[] | undefined) ?? []
      const hasPendingVideo = items.some(
        (track) =>
          Boolean(track.videoJobId) &&
          track.videoStatus !== "completed" &&
          track.videoStatus !== "failed"
      )

      return hasPendingVideo ? 8000 : false
    },
  })

  useEffect(() => {
    setQueue(tracks)

    if (currentTrack || tracks.length === 0) {
      return
    }

    const initialTrack = tracks[0]

    if (!initialTrack) {
      return
    }

    const selectionTimer = window.setTimeout(() => {
      setCurrentTrack(initialTrack)
    }, 0)

    return () => window.clearTimeout(selectionTimer)
  }, [currentTrack, setCurrentTrack, setQueue, tracks])

  useEffect(() => {
    const previousCurrentTrackId = previousCurrentTrackIdRef.current

    if (
      selectedTrackId &&
      currentTrack &&
      selectedTrackId === previousCurrentTrackId &&
      currentTrack.id !== previousCurrentTrackId
    ) {
      setSelectedTrackId(currentTrack.id)
    }

    previousCurrentTrackIdRef.current = currentTrack?.id ?? null
  }, [currentTrack, selectedTrackId])

  const selectedTrack = useMemo(() => {
    if (!selectedTrackId) {
      return null
    }

    if (currentTrack?.id === selectedTrackId) {
      return currentTrack
    }

    return tracks.find((track) => track.id === selectedTrackId) ?? null
  }, [currentTrack, selectedTrackId, tracks])
  const isSelectedTrackPlaying = Boolean(
    selectedTrack && currentTrack?.id === selectedTrack.id && isPlaying
  )

  const shouldShowSelectedTrackVideo = Boolean(
    selectedTrack &&
      currentTrack?.id === selectedTrack.id &&
      isPlaying &&
      selectedTrack.videoStatus === "completed" &&
      selectedTrack.videoUrl
  )

  useEffect(() => {
    const video = videoRef.current

    if (!video) {
      return
    }

    if (!shouldShowSelectedTrackVideo) {
      video.pause()
      video.currentTime = 0
      return
    }

    void video.play().catch(() => {
      return
    })
  }, [shouldShowSelectedTrackVideo])

  useEffect(() => {
    const video = videoRef.current

    if (!video || !shouldShowSelectedTrackVideo) {
      return
    }

    if (Math.abs(video.currentTime - currentTime) > 0.35) {
      video.currentTime = currentTime
    }
  }, [currentTime, shouldShowSelectedTrackVideo])

  const visibleTracks = useMemo(() => {
    const normalizedSearch = deferredSearch.trim().toLowerCase()
    return tracks.filter((track) => {
      return (
        normalizedSearch.length === 0 ||
        track.title.toLowerCase().includes(normalizedSearch)
      )
    })
  }, [deferredSearch, tracks])

  useEffect(() => {
    if (surpriseRequestId === handledSurpriseRequestIdRef.current) {
      return
    }

    const candidates = visibleTracks.length > 0 ? visibleTracks : tracks

    if (candidates.length === 0) {
      return
    }

    handledSurpriseRequestIdRef.current = surpriseRequestId

    const nextTrack = candidates[Math.floor(Math.random() * candidates.length)]

    if (!nextTrack) {
      return
    }

    const surpriseTimer = window.setTimeout(() => {
      setSelectedTrackId(nextTrack.id)
      requestPlayTrack(nextTrack)
    }, 0)

    return () => window.clearTimeout(surpriseTimer)
  }, [requestPlayTrack, surpriseRequestId, tracks, visibleTracks])

  return (
    <section className={selectedTrack ? "" : "space-y-6"}>
      {selectedTrack ? (
        <div className="-mx-4 -mb-56 overflow-y-auto border-y border-border bg-background/78 shadow-[inset_0_1px_0_rgba(238,244,237,0.05)] sm:-mx-6 lg:-mx-8 lg:h-[calc(100svh-15rem)] lg:min-h-[580px] lg:overflow-hidden">
          <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:px-6 lg:h-full lg:px-8">
            <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.95fr)] lg:items-stretch">
              {/* Visualizer Panel */}
              <div className="hud-panel flex min-h-[360px] flex-col justify-between overflow-hidden rounded-[5px] bg-background/45 p-4 shadow-[0_24px_62px_rgba(0,0,0,0.4),0_0_36px_rgba(183,243,91,0.12)] sm:min-h-[420px] lg:min-h-0">
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 rounded-[4px]"
                      onClick={() => setSelectedTrackId(null)}
                      aria-label="Back to tracks"
                    >
                      <ArrowLeft className="size-4" />
                    </Button>
                    <div className="min-w-0">
                      <span className="terminal-label">audio visual module</span>
                      <p className="truncate text-sm font-black text-foreground sm:text-base">
                        {selectedTrack.title}
                      </p>
                    </div>
                  </div>
                  <Button
                    size="icon"
                    className="size-9 rounded-[4px]"
                    onClick={() => {
                      if (isSelectedTrackPlaying) {
                        requestPausePlayback()
                        return
                      }

                      requestPlayTrack(selectedTrack)
                    }}
                    aria-label={
                      isSelectedTrackPlaying ? "Pause track" : "Play track"
                    }
                  >
                    {isSelectedTrackPlaying ? (
                      <Pause className="size-4" />
                    ) : (
                      <Play className="size-4 translate-x-px" />
                    )}
                  </Button>
                </div>

                <div className="relative flex flex-1 items-center justify-center overflow-hidden">
                  <div className="absolute inset-5 rounded-[4px] border border-acid/18 bg-[radial-gradient(circle_at_center,_rgba(183,243,91,0.12),_transparent_42%)] shadow-[inset_0_0_68px_rgba(183,243,91,0.08)]" />
                  <div className="absolute inset-x-8 top-1/2 h-px bg-gradient-to-r from-transparent via-cyan/50 to-transparent" />
                  {shouldShowSelectedTrackVideo ? (
                    <div className="relative aspect-square w-full max-w-[320px] overflow-hidden rounded-[6px] border border-border bg-muted/30 shadow-[0_24px_80px_rgba(0,0,0,0.45),0_0_36px_rgba(183,243,91,0.14)]">
                      <video
                        ref={videoRef}
                        src={selectedTrack.videoUrl}
                        poster={selectedTrack.coverUrl || undefined}
                        className="size-full object-cover"
                        muted
                        playsInline
                      />
                    </div>
                  ) : selectedTrack.coverUrl ? (
                    <div className="relative aspect-square w-full max-w-[320px] overflow-hidden rounded-[6px] border border-border bg-muted/30 shadow-[0_24px_80px_rgba(0,0,0,0.45),0_0_36px_rgba(183,243,91,0.14)]">
                      <img
                        src={selectedTrack.coverUrl}
                        alt={selectedTrack.title}
                        className="size-full object-cover"
                      />
                    </div>
                  ) : (
                    <div
                      className="relative flex h-48 items-end gap-2 sm:h-64"
                      aria-hidden="true"
                    >
                      {EMPTY_EQUALIZER_BARS.map((bar) => (
                        <span
                          key={bar.id}
                          className="equalizer-bar w-2 rounded-sm bg-acid shadow-[0_0_16px_rgba(183,243,91,0.24)] sm:w-2.5"
                          style={{
                            animationDelay: bar.animationDelay,
                            height: bar.height,
                          }}
                        />
                      ))}
                    </div>
                  )}
                </div>

                <div className="grid gap-3 border-t border-border pt-3 sm:grid-cols-3">
                  <div>
                    <p className="terminal-label">song id</p>
                    <p className="mt-1 text-base font-black text-acid">
                      {selectedTrack.id.slice(0, 8)}
                    </p>
                  </div>
                  <div>
                    <p className="terminal-label">mix bus</p>
                    <p className="mt-1 text-base font-black text-foreground">
                      stereo
                    </p>
                  </div>
                  <div>
                    <p className="terminal-label">queue state</p>
                    <p className="mt-1 text-base font-black text-cyan">armed</p>
                  </div>
                </div>
              </div>

              {/* Lyrics Panel */}
              <div className="hud-panel flex min-h-[320px] flex-col overflow-hidden rounded-[5px] lg:min-h-0">
                <div className="flex items-center justify-between gap-3 border-b border-border bg-background/45 px-5 py-3">
                  <div>
                    <p className="terminal-label">lyrics</p>
                    <h3 className="text-lg font-black tracking-[-0.02em]">
                      Broadcast transcript
                    </h3>
                  </div>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
                  <div className="slop-sheet space-y-6 rounded-[3px] border border-border-strong px-5 py-5 shadow-[0_18px_42px_rgba(0,0,0,0.32),0_0_26px_rgba(183,214,106,0.06)]">
                    {(selectedTrack.lyrics ?? selectedTrack.prompt ?? "")
                      .split("\n\n")
                      .map((section, idx) => (
                        <div key={idx} className="space-y-2">
                          {section.split("\n").map((line, lIdx) => (
                            <p
                              key={lIdx}
                              className="max-w-3xl text-base leading-8 font-semibold text-foreground sm:text-lg"
                            >
                              {line}
                            </p>
                          ))}
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="mx-auto max-w-7xl space-y-6">
          <div className="hud-panel overflow-hidden rounded-[4px] px-5 py-5 sm:px-6">
            <div className="relative z-10 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="terminal-label">music library / generated tracks</p>
                <h1 className="text-3xl font-black tracking-[-0.03em] text-foreground sm:text-5xl">
                  Slopify track library
                </h1>
              </div>
              <div className="flex items-center gap-2 rounded-md border border-border bg-background/45 px-3 py-2 font-mono text-xs font-bold tracking-[0.18em] text-muted-foreground uppercase shadow-[inset_0_1px_0_rgba(238,244,237,0.05)]">
                <span className="status-dot" />
                signal ready
              </div>
            </div>
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {SKELETON_ROWS.map((index) => (
                <div
                  key={index}
                  className="h-16 animate-pulse rounded-[3px] border border-border bg-muted/70"
                />
              ))}
            </div>
          ) : (
            <div className="hud-panel overflow-hidden rounded-[4px]">
              <div className="hidden grid-cols-[minmax(0,1fr)_5rem_11rem_11rem_6rem] items-center gap-4 border-b border-border bg-muted/25 px-6 py-3 font-mono text-xs font-bold tracking-[0.18em] text-muted-foreground uppercase md:grid">
                <span>Output Queue</span>
                <span className="text-center">Play</span>
                <span>Signal Type</span>
                <span>Node Time</span>
                <span className="text-right">Runtime</span>
              </div>
              <div className="divide-y divide-border">
                {visibleTracks.map((track) => {
                  const isCurrentTrack = currentTrack?.id === track.id
                  const isTrackPlaying = isCurrentTrack && isPlaying
                  return (
                    <div
                      key={track.id}
                      className={`grid grid-cols-[minmax(0,1fr)_44px] items-center gap-4 px-4 py-3 transition-all hover:bg-acid/10 hover:shadow-[inset_3px_0_0_var(--acid)] md:grid-cols-[minmax(0,1fr)_5rem_11rem_11rem_6rem] md:px-6 ${
                        isCurrentTrack
                          ? "bg-acid/12 shadow-[inset_3px_0_0_var(--acid)]"
                          : ""
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setCurrentTrack(track)
                          setSelectedTrackId(track.id)
                        }}
                        className="flex min-w-0 items-center gap-4 text-left"
                      >
                        <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-[3px] border border-border bg-muted/40 shadow-inner shadow-black/30">
                          {track.coverUrl ? (
                            <img
                              src={track.coverUrl}
                              alt={track.title}
                              className="size-full object-cover"
                            />
                          ) : (
                            <div className="flex size-8 items-center justify-center rounded-[2px] border border-acid/45 bg-acid/12 font-mono text-[10px] font-black text-acid">
                              AI
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-lg font-black tracking-[-0.01em] sm:text-xl">
                            {track.title}
                          </p>
                          <p className="terminal-label md:hidden">
                            {track.vibe} / {track.duration}
                          </p>
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (isTrackPlaying) {
                            requestPausePlayback()
                            return
                          }

                          requestPlayTrack(track)
                        }}
                        aria-label={
                          isTrackPlaying ? "Pause track" : "Play track"
                        }
                        className="flex size-9 items-center justify-center justify-self-center rounded-[3px] border border-border bg-background text-foreground shadow-sm transition-all hover:bg-acid hover:text-primary-foreground"
                      >
                        {isTrackPlaying ? (
                          <Pause className="size-4" />
                        ) : (
                          <Play className="size-4 translate-x-px" />
                        )}
                      </button>
                      <span className="hidden text-sm text-muted-foreground md:block md:truncate">
                        {track.vibe}
                      </span>
                      <span className="hidden text-sm text-muted-foreground md:block md:truncate">
                        {track.dateAdded}
                      </span>
                      <span className="hidden text-right text-sm text-muted-foreground md:block">
                        {track.duration}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {!isLoading && visibleTracks.length === 0 && (
            <div className="rounded-[4px] border border-dashed border-border bg-muted/30 px-6 py-12 text-center">
              <p className="text-lg font-medium">
                No tracks match this search.
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Try a different phrase or switch the filter.
              </p>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
