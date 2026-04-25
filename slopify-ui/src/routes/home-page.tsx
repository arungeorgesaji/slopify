import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { ArrowLeft, Play } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { useSlopifyAppContext } from "@/components/slopify-app-context"
import {
  fetchTracks,
  fakeDurationForTrack,
  fakeVibeForTrack,
  PLACEHOLDER_LYRICS,
  TOPIC_FILTERS,
  type Track,
} from "@/lib/mock-tracks"

export function HomePage() {
  const { search, setCurrentTrack } = useSlopifyAppContext()
  const deferredSearch = useDeferredValue(search)
  const [activeFilter, setActiveFilter] =
    useState<(typeof TOPIC_FILTERS)[number]>("All")
  const [selectedTrack, setSelectedTrack] = useState<Track | null>(null)
  const lyricsScrollerRef = useRef<HTMLDivElement | null>(null)

  const { data: tracks = [], isLoading } = useQuery({
    queryKey: ["tracks"],
    queryFn: fetchTracks,
  })

  const visibleTracks = useMemo(() => {
    const normalizedSearch = deferredSearch.trim().toLowerCase()
    return tracks.filter((track) => {
      const matchesSearch =
        normalizedSearch.length === 0 ||
        track.title.toLowerCase().includes(normalizedSearch)
      const matchesFilter =
        activeFilter === "All" ||
        fakeVibeForTrack(track.id)
          .toLowerCase()
          .includes(activeFilter.toLowerCase())

      return matchesSearch && matchesFilter
    })
  }, [activeFilter, deferredSearch, tracks])

  useEffect(() => {
    if (!selectedTrack || !lyricsScrollerRef.current) {
      return
    }

    const scroller = lyricsScrollerRef.current
    scroller.scrollTo({ top: 0, behavior: "auto" })

    const interval = window.setInterval(() => {
      const maxScrollTop = scroller.scrollHeight - scroller.clientHeight

      if (maxScrollTop <= 0) {
        return
      }

      const nextScrollTop = scroller.scrollTop + 1

      if (nextScrollTop >= maxScrollTop) {
        window.clearInterval(interval)
        return
      }

      scroller.scrollTo({ top: nextScrollTop, behavior: "auto" })
    }, 70)

    return () => {
      window.clearInterval(interval)
    }
  }, [selectedTrack])

  return (
    <section className={selectedTrack ? "" : "space-y-6"}>
      {selectedTrack ? (
        <div className="-mx-4 -mb-44 h-[calc(100svh-18rem)] overflow-hidden sm:-mx-6 lg:-mx-8">
          <div className="grid h-full min-h-0 lg:grid-cols-[minmax(0,0.95fr)_minmax(460px,1.05fr)]">
            <div className="flex min-h-0 flex-col border-r border-border/70 bg-background">
              <div className="flex items-center border-b border-border/70 bg-background/95 px-6 py-5 backdrop-blur">
                <div className="min-w-0">
                  <div className="flex items-center gap-4">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-10 rounded-full"
                      onClick={() => setSelectedTrack(null)}
                    >
                      <ArrowLeft className="size-5" />
                    </Button>
                    <h2 className="truncate text-3xl font-semibold">
                      {selectedTrack.title}
                    </h2>
                    <Badge variant="outline" className="rounded-full px-3 py-1">
                      {fakeVibeForTrack(selectedTrack.id)}
                    </Badge>
                  </div>
                </div>
              </div>

              <div
                ref={lyricsScrollerRef}
                className="min-h-0 flex-1 overflow-y-auto px-6 py-6"
              >
                <div className="max-w-2xl space-y-8">
                  {PLACEHOLDER_LYRICS.split("\n\n").map((section) => (
                    <div key={section} className="space-y-3">
                      {section.split("\n").map((line) => (
                        <p
                          key={line}
                          className="max-w-xl text-xl leading-10 text-foreground"
                        >
                          {line}
                        </p>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="min-h-0 bg-[radial-gradient(circle_at_top,_rgba(37,99,235,0.28),_transparent_36%),linear-gradient(180deg,_rgba(219,234,254,0.7),_rgba(255,255,255,0.94))]">
              <div className="flex h-full min-h-0 w-full items-center justify-center bg-transparent">
                <div className="flex h-full w-full items-center justify-center border-2 border-dashed border-border/70 bg-background/35">
                  <span className="text-sm font-medium text-muted-foreground">
                    Visualizer Placeholder
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="mx-auto max-w-7xl space-y-6">
          <ScrollArea className="w-full whitespace-nowrap">
            <div className="flex gap-2 pb-2">
              {TOPIC_FILTERS.map((filter) => {
                const isActive = filter === activeFilter
                return (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => setActiveFilter(filter)}
                    className="cursor-pointer"
                  >
                    <Badge
                      variant={isActive ? "default" : "outline"}
                      className="h-9 rounded-full px-4 text-sm"
                    >
                      {filter}
                    </Badge>
                  </button>
                )
              })}
            </div>
          </ScrollArea>

          <Separator />

          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 6 }, (_, index) => (
                <div
                  key={index}
                  className="h-16 animate-pulse rounded-xl border border-border/70 bg-muted/70"
                />
              ))}
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm shadow-primary/5">
              <div className="grid grid-cols-[minmax(0,1fr)_64px_160px_144px_96px] border-b border-border/70 bg-muted/30 px-6 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                <span>Title</span>
                <span>Play</span>
                <span>Vibe</span>
                <span>Date Added</span>
                <span className="text-right">Length</span>
              </div>
              <div>
                {visibleTracks.map((track) => (
                  <div
                    key={track.id}
                    className="grid grid-cols-[minmax(0,1fr)_64px_160px_144px_96px] items-center gap-4 border-b border-border/70 px-6 py-3 transition-colors hover:bg-muted/30 last:border-b-0"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setCurrentTrack(track)
                        setSelectedTrack(track)
                      }}
                      className="flex min-w-0 items-center gap-4 text-left"
                    >
                      <div className="flex size-14 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-muted/40">
                        <div className="size-8 rounded-md bg-primary/15" />
                      </div>
                      <p className="truncate text-xl font-semibold">
                        {track.title}
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setCurrentTrack(track)}
                      className="flex size-9 items-center justify-center rounded-full border border-border bg-background text-foreground shadow-sm transition-colors hover:border-primary hover:bg-primary hover:text-primary-foreground"
                      aria-label={`Play ${track.title}`}
                    >
                      <Play className="size-4 translate-x-px" />
                    </button>
                    <span className="text-sm text-muted-foreground">
                      {fakeVibeForTrack(track.id)}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      --
                    </span>
                    <div className="min-w-0">
                      <span className="block text-right text-sm text-muted-foreground">
                        {fakeDurationForTrack(track.id)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!isLoading && visibleTracks.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-muted/30 px-6 py-12 text-center">
              <p className="text-lg font-medium">
                No tracks match this search.
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Try a different phrase or switch topics.
              </p>
            </div>
          ) : null}
        </div>
      )}
    </section>
  )
}
