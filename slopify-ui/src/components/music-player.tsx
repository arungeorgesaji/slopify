import { useState } from "react"
import { Pause, Play, SkipBack, SkipForward, Volume2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { useSlopifyAppContext } from "@/components/slopify-app-context"
import { fakeDurationForTrack } from "@/lib/mock-tracks"

export function MusicPlayer() {
  const { currentTrack } = useSlopifyAppContext()
  const [isPlaying, setIsPlaying] = useState(false)
  const [progress, setProgress] = useState([38])
  const [volume, setVolume] = useState([72])

  const handleProgressChange = (value: number | readonly number[]) => {
    setProgress(Array.isArray(value) ? [...value] : [value])
  }

  const handleVolumeChange = (value: number | readonly number[]) => {
    setVolume(Array.isArray(value) ? [...value] : [value])
  }

  return (
    <footer className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/84 text-foreground shadow-[0_-18px_62px_rgba(0,0,0,0.5)] backdrop-blur-xl">
      <div className="mx-auto grid w-full max-w-7xl grid-cols-[minmax(0,1fr)_auto] gap-3 px-4 py-3 sm:px-6 lg:grid-cols-[1fr_auto_1fr] lg:items-center lg:px-8">
        <div className="min-w-0 rounded-[3px] border border-border bg-surface/80 px-4 py-3 shadow-[inset_0_1px_0_rgba(238,244,237,0.05)]">
          <div className="mb-1 flex items-center gap-2">
            <span className="status-dot" />
            <span className="terminal-label">signal ready</span>
          </div>
          <p className="truncate text-sm font-semibold text-foreground">
            {currentTrack.title}
          </p>
        </div>

        <div className="col-span-2 flex w-full max-w-3xl flex-col items-center gap-2 justify-self-center rounded-[3px] border border-border bg-surface/80 px-4 py-3 shadow-[inset_0_1px_0_rgba(238,244,237,0.06),0_14px_34px_rgba(0,0,0,0.34),0_0_22px_rgba(122,184,176,0.07)] lg:col-span-1 lg:min-w-[28rem]">
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="size-8 rounded-md text-foreground hover:text-primary"
              aria-label="Previous track"
            >
              <SkipBack className="size-4" />
            </Button>
            <Button
              size="icon"
              className="size-10 rounded-md"
              aria-label={isPlaying ? "Pause" : "Play"}
              onClick={() => setIsPlaying((current) => !current)}
            >
              {isPlaying ? (
                <Pause className="size-4" />
              ) : (
                <Play className="size-4 translate-x-px" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 rounded-md text-foreground hover:text-primary"
              aria-label="Next track"
            >
              <SkipForward className="size-4" />
            </Button>
          </div>

          <div className="flex w-full items-center gap-3 font-mono text-[11px] text-muted-foreground">
            <span>1:12</span>
            <Slider
              value={progress}
              onValueChange={handleProgressChange}
              aria-label="Track progress"
              className="[&_[data-slot=slider-range]]:bg-acid [&_[data-slot=slider-thumb]]:border-acid/80 [&_[data-slot=slider-thumb]]:bg-background [&_[data-slot=slider-thumb]]:shadow-[0_0_14px_rgba(183,214,106,0.3)] [&_[data-slot=slider-track]]:bg-acid/16"
            />
            <span>{fakeDurationForTrack(currentTrack.id)}</span>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-[3px] border border-border bg-surface/80 px-3 py-3 shadow-[inset_0_1px_0_rgba(238,244,237,0.05)] lg:justify-self-end lg:px-4">
          <div className="hidden h-6 items-end gap-0.5 sm:flex" aria-hidden="true">
            {[0, 1, 2, 3].map((bar) => (
              <span
                key={bar}
                className="equalizer-bar block w-1 rounded-sm bg-amber"
                style={{
                  animationDelay: `${bar * 0.13}s`,
                  height: `${12 + bar * 3}px`,
                }}
              />
            ))}
          </div>
          <Volume2 className="size-4 shrink-0 text-cyan" />
          <div className="w-24 sm:w-32">
            <Slider
              value={volume}
              onValueChange={handleVolumeChange}
              aria-label="Volume"
              className="[&_[data-slot=slider-range]]:bg-cyan [&_[data-slot=slider-thumb]]:border-cyan/80 [&_[data-slot=slider-thumb]]:bg-background [&_[data-slot=slider-thumb]]:shadow-[0_0_14px_rgba(122,184,176,0.3)] [&_[data-slot=slider-track]]:bg-cyan/16"
            />
          </div>
        </div>
      </div>
    </footer>
  )
}
