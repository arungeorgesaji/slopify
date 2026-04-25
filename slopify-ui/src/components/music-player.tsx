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
    <footer className="fixed inset-x-0 bottom-0 z-40 border-t border-primary/80 bg-primary text-primary-foreground shadow-[0_-16px_40px_rgba(37,99,235,0.28)]">
      <div className="mx-auto grid w-full max-w-7xl gap-3 px-4 py-3 sm:px-6 lg:grid-cols-[1fr_auto_1fr] lg:items-center lg:px-8">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{currentTrack.title}</p>
        </div>

        <div className="flex w-full min-w-[28rem] max-w-3xl flex-col items-center gap-2 justify-self-center">
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="size-7 rounded-full text-primary-foreground hover:bg-white/15 hover:text-primary-foreground"
              aria-label="Previous track"
            >
              <SkipBack className="size-4" />
            </Button>
            <Button
              size="icon"
              className="size-9 rounded-full bg-white text-primary shadow-sm hover:bg-white/90"
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
              className="size-7 rounded-full text-primary-foreground hover:bg-white/15 hover:text-primary-foreground"
              aria-label="Next track"
            >
              <SkipForward className="size-4" />
            </Button>
          </div>

          <div className="flex w-full items-center gap-3 text-[11px] text-primary-foreground/80">
            <span>1:12</span>
            <Slider
              value={progress}
              onValueChange={handleProgressChange}
              aria-label="Track progress"
              className="[&_[data-slot=slider-range]]:bg-white [&_[data-slot=slider-thumb]]:border-white/60 [&_[data-slot=slider-thumb]]:bg-white [&_[data-slot=slider-track]]:bg-white/25"
            />
            <span>{fakeDurationForTrack(currentTrack.id)}</span>
          </div>
        </div>

        <div className="flex items-center gap-3 lg:justify-self-end">
          <Volume2 className="size-4 shrink-0 text-primary-foreground/80" />
          <div className="w-32">
            <Slider
              value={volume}
              onValueChange={handleVolumeChange}
              aria-label="Volume"
              className="[&_[data-slot=slider-range]]:bg-white [&_[data-slot=slider-thumb]]:border-white/60 [&_[data-slot=slider-thumb]]:bg-white [&_[data-slot=slider-track]]:bg-white/25"
            />
          </div>
        </div>
      </div>
    </footer>
  )
}
