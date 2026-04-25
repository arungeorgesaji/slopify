import { useDeferredValue, useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { ArrowLeft, Play } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { useSlopifyAppContext } from "@/components/slopify-app-context"
import { fetchTracks, TOPIC_FILTERS, type Track } from "@/lib/tracks"

export function HomePage() {
  const { search, setCurrentTrack } = useSlopifyAppContext()
  const deferredSearch = useDeferredValue(search)
  const [activeFilter, setActiveFilter] = useState<
    (typeof TOPIC_FILTERS)[number] | null
  >(null)
  const [selectedTrack, setSelectedTrack] = useState<Track | null>(null)

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
        activeFilter === null ||
        track.vibe.toLowerCase() === activeFilter.toLowerCase()

      return matchesSearch && matchesFilter
    })
  }, [activeFilter, deferredSearch, tracks])

  return (
    <section className={selectedTrack ? "" : "space-y-6"}>
      {selectedTrack ? (
        <div className="-mx-4 -mb-56 overflow-y-auto border-y border-border bg-background/78 shadow-[inset_0_1px_0_rgba(238,244,237,0.05)] sm:-mx-6 lg:-mx-8 lg:h-[calc(100svh-21rem)] lg:min-h-[560px] lg:overflow-hidden">
          <div className="mx-auto grid max-w-7xl gap-4 px-4 py-4 sm:px-6 lg:h-full lg:grid-cols-[minmax(280px,0.72fr)_minmax(460px,1.28fr)] lg:px-8">
            <div className="hud-panel flex min-h-0 flex-col overflow-hidden rounded-[5px]">
              <div className="relative z-10 flex flex-1 flex-col gap-4 p-4 sm:p-5">
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-9 rounded-[4px]"
                    onClick={() => setSelectedTrack(null)}
                  >
                    <ArrowLeft className="size-4" />
                  </Button>
                  <span className="terminal-label">track loaded</span>
                  <span className="slop-stamp">signal ready</span>
                </div>

                <div className="min-w-0">
                  <h2 className="text-2xl font-black tracking-[-0.03em] text-foreground sm:text-4xl">
                    {selectedTrack.title}
                  </h2>
                  <p className="mt-2 max-w-xl text-sm font-medium text-muted-foreground">
                    Slopify output channel / synthetic hook analysis.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className="rounded-[3px] px-3 py-1">
                    {selectedTrack.vibe}
                  </Badge>
                  <Badge variant="outline" className="rounded-[3px] px-3 py-1">
                    {selectedTrack.status}
                  </Badge>
                  <Badge variant="outline" className="rounded-[3px] px-3 py-1">
                    {selectedTrack.duration}
                  </Badge>
                </div>

                <Button
                  className="mt-1 h-11 w-full justify-center rounded-[4px] font-black tracking-[0.12em] uppercase sm:w-fit sm:px-7"
                  onClick={() => setCurrentTrack(selectedTrack)}
                >
                  <Play className="size-4 translate-x-px" />
                  Play Track
                </Button>

                <div className="mt-auto grid gap-3 border-t border-border pt-4 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
                  <div>
                    <p className="terminal-label">slop index</p>
                    <p className="mt-1 text-lg font-black text-acid">
                      {selectedTrack.id.slice(0, 8)}
                    </p>
                  </div>
                  <div>
                    <p className="terminal-label">mix bus</p>
                    <p className="mt-1 text-lg font-black text-foreground">
                      stereo
                    </p>
                  </div>
                  <div>
                    <p className="terminal-label">queue state</p>
                    <p className="mt-1 text-lg font-black text-cyan">armed</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid min-h-0 gap-4 lg:grid-rows-[minmax(320px,7fr)_minmax(160px,3fr)]">
              <div className="hud-panel flex min-h-[320px] flex-col justify-between overflow-hidden rounded-[5px] bg-background/45 p-4 shadow-[0_24px_62px_rgba(0,0,0,0.4),0_0_36px_rgba(183,243,91,0.12)] lg:min-h-0">
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <span className="terminal-label">audio core</span>
                  <span className="flex items-center gap-2 font-mono text-[10px] font-black tracking-[0.18em] text-cyan uppercase">
                    <span className="status-dot" />
                    live feed
                  </span>
                </div>
                <div className="relative flex flex-1 items-center justify-center overflow-hidden">
                  <div className="absolute inset-6 rounded-full border border-acid/20 shadow-[inset_0_0_58px_rgba(183,243,91,0.08)]" />
                  <div
                    className="relative flex h-40 items-end gap-2 sm:h-52"
                    aria-hidden="true"
                  >
                    {Array.from({ length: 18 }, (_, index) => (
                      <span
                        key={index}
                        className="equalizer-bar w-2 rounded-sm bg-acid shadow-[0_0_16px_rgba(183,243,91,0.24)] sm:w-2.5"
                        style={{
                          animationDelay: `${index * 0.06}s`,
                          height: `${32 + (index % 7) * 16}px`,
                        }}
                      />
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between border-t border-border pt-3">
                  <span className="slop-stamp">visual feed</span>
                  <span className="font-mono text-[10px] font-bold tracking-[0.18em] text-muted-foreground uppercase">
                    output monitor
                  </span>
                </div>
              </div>

              <div className="hud-panel min-h-0 overflow-hidden rounded-[5px]">
                <div className="flex items-center justify-between gap-3 border-b border-border bg-background/45 px-5 py-3">
                  <div>
                    <p className="terminal-label">lyric stream</p>
                    <h3 className="text-lg font-black tracking-[-0.02em]">
                      Broadcast transcript
                    </h3>
                  </div>
                  <span className="slop-stamp">manual scroll</span>
                </div>
                <div className="max-h-[240px] overflow-y-auto px-4 py-4 sm:px-5 lg:h-full lg:max-h-none">
                  <div className="slop-sheet space-y-6 rounded-[3px] border border-border-strong px-5 py-5 shadow-[0_18px_42px_rgba(0,0,0,0.32),0_0_26px_rgba(183,214,106,0.06)]">
                    {(selectedTrack.lyrics ?? selectedTrack.prompt)
                      .split("\n\n")
                      .map((section) => (
                        <div key={section} className="space-y-2">
                          {section.split("\n").map((line) => (
                            <p
                              key={line}
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
                <p className="terminal-label">
                  generation node / ai sound terminal
                </p>
                <h1 className="text-3xl font-black tracking-[-0.03em] text-foreground sm:text-5xl">
                  Slopify audio console
                </h1>
                <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                  A futuristic sound lab for synthetic tracks, strange hooks,
                  and broadcast-ready slop.
                </p>
              </div>
              <div className="flex items-center gap-2 rounded-md border border-border bg-background/45 px-3 py-2 font-mono text-xs font-bold tracking-[0.18em] text-muted-foreground uppercase shadow-[inset_0_1px_0_rgba(238,244,237,0.05)]">
                <span className="status-dot" />
                signal ready
              </div>
            </div>
          </div>
          <ScrollArea className="w-full whitespace-nowrap">
            <div className="flex gap-2 pb-2">
              {TOPIC_FILTERS.map((filter) => {
                const isActive = filter === activeFilter
                return (
                  <button
                    key={filter}
                    type="button"
                    onClick={() =>
                      setActiveFilter((current) =>
                        current === filter ? null : filter
                      )
                    }
                    className="cursor-pointer"
                  >
                    <Badge
                      variant={isActive ? "default" : "outline"}
                      className="h-9 rounded-[3px] px-4 font-mono text-sm tracking-wide uppercase"
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
                  className="h-16 animate-pulse rounded-[3px] border border-border bg-muted/70"
                />
              ))}
            </div>
          ) : (
            <div className="hud-panel overflow-hidden rounded-[4px]">
              <div className="hidden grid-cols-[minmax(0,1fr)_64px_160px_144px_96px] border-b border-border bg-muted/25 px-6 py-3 font-mono text-xs font-bold tracking-[0.18em] text-muted-foreground uppercase md:grid">
                <span>Output Queue</span>
                <span>Play</span>
                <span>Signal Type</span>
                <span>Node Time</span>
                <span className="text-right">Runtime</span>
              </div>
              <div>
                {visibleTracks.map((track) => (
                  <div
                    key={track.id}
                    className="grid grid-cols-[minmax(0,1fr)_44px] items-center gap-4 border-b border-border px-4 py-3 transition-all last:border-b-0 hover:bg-acid/10 hover:shadow-[inset_3px_0_0_var(--acid)] md:grid-cols-[minmax(0,1fr)_64px_160px_144px_96px] md:px-6"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setCurrentTrack(track)
                        setSelectedTrack(track)
                      }}
                      className="flex min-w-0 items-center gap-4 text-left"
                    >
                      <div className="flex size-14 shrink-0 items-center justify-center rounded-[3px] border border-border bg-muted/40 shadow-inner shadow-black/30">
                        <div className="flex size-8 items-center justify-center rounded-[2px] border border-acid/45 bg-acid/12 font-mono text-[10px] font-black text-acid shadow-[0_0_16px_rgba(183,214,106,0.1)]">
                          AI
                        </div>
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
                      onClick={() => setCurrentTrack(track)}
                      className="flex size-9 items-center justify-center rounded-[3px] border border-border bg-background text-foreground shadow-sm transition-all hover:-translate-y-0.5 hover:border-acid/70 hover:bg-acid hover:text-primary-foreground hover:shadow-[0_0_22px_rgba(183,214,106,0.22)] active:translate-y-px"
                      aria-label={`Play ${track.title}`}
                    >
                      <Play className="size-4 translate-x-px" />
                    </button>
                    <span className="hidden text-sm text-muted-foreground md:block">
                      {track.vibe}
                    </span>
                    <span className="hidden text-sm text-muted-foreground md:block">
                      {track.dateAdded}
                    </span>
                    <div className="hidden min-w-0 md:block">
                      <span className="block text-right text-sm text-muted-foreground">
                        {track.duration}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!isLoading && visibleTracks.length === 0 ? (
            <div className="rounded-[4px] border border-dashed border-border bg-muted/30 px-6 py-12 text-center">
              <p className="text-lg font-medium">
                No slop tracks match this search.
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Try a worse phrase or switch the vibe filter.
              </p>
            </div>
          ) : null}
        </div>
      )}
    </section>
  )
}
