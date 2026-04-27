import { useEffect, useRef, useState } from "react"
import { Pause, Play, SkipBack, SkipForward, Volume2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { useSlopifyAppContext } from "@/components/slopify-app-context"
import { refreshTrack } from "@/lib/tracks"

export function MusicPlayer() {
  const { currentTrack, queue, setCurrentTrack, setQueue } =
    useSlopifyAppContext()
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [progress, setProgress] = useState([0])
  const [currentTime, setCurrentTime] = useState(0)
  const [volume, setVolume] = useState([72])
  const [audioError, setAudioError] = useState<string | null>(null)
  const currentAudioUrl = currentTrack?.audioUrl ?? null

  useEffect(() => {
    audioRef.current?.pause()
    audioRef.current?.load()

    const resetTimer = window.setTimeout(() => {
      setIsPlaying(false)
      setProgress([0])
      setCurrentTime(0)
      setAudioError(null)
    }, 0)

    return () => window.clearTimeout(resetTimer)
  }, [currentAudioUrl])

  useEffect(() => {
    if (!audioRef.current) {
      return
    }

    audioRef.current.volume = volume[0] / 100
  }, [volume])

  useEffect(() => {
    if (
      !currentTrack ||
      !currentTrack.videoJobId ||
      currentTrack.videoStatus === "completed" ||
      currentTrack.videoStatus === "failed"
    ) {
      return
    }

    let cancelled = false

    const syncTrack = async () => {
      try {
        const refreshedTrack = await refreshTrack(currentTrack)

        if (!refreshedTrack || cancelled) {
          return
        }

        setCurrentTrack((existing) =>
          existing?.id === refreshedTrack.id ? refreshedTrack : existing
        )
        setQueue((existingQueue) =>
          existingQueue.map((queuedTrack) =>
            queuedTrack.id === refreshedTrack.id ? refreshedTrack : queuedTrack
          )
        )
      } catch {
        return
      }
    }

    void syncTrack()
    const intervalId = window.setInterval(() => {
      void syncTrack()
    }, 8000)

    return () => {
      cancelled = true
      window.clearInterval(intervalId)
    }
  }, [currentTrack, setCurrentTrack, setQueue])

  const handleProgressChange = (value: number | readonly number[]) => {
    const nextProgress = Array.isArray(value) ? value[0] : value

    setProgress([nextProgress])

    if (audioRef.current && Number.isFinite(audioRef.current.duration)) {
      const nextCurrentTime = audioRef.current.duration * (nextProgress / 100)

      audioRef.current.currentTime = nextCurrentTime
      setCurrentTime(nextCurrentTime)
    }
  }

  const handleVolumeChange = (value: number | readonly number[]) => {
    setVolume(Array.isArray(value) ? [...value] : [value])
  }

  const handlePlayToggle = () => {
    if (!audioRef.current || !currentTrack?.audioUrl) {
      return
    }

    if (isPlaying) {
      audioRef.current.pause()
      setIsPlaying(false)
      return
    }

    void audioRef.current
      .play()
      .then(() => {
        setAudioError(null)
        setIsPlaying(true)
      })
      .catch(() => {
        setIsPlaying(false)
        setAudioError("Audio failed")
      })
  }

  const handleTimeUpdate = () => {
    if (!audioRef.current || !Number.isFinite(audioRef.current.duration)) {
      return
    }

    const nextCurrentTime = audioRef.current.currentTime

    setCurrentTime(nextCurrentTime)
    setProgress([(nextCurrentTime / audioRef.current.duration) * 100])
  }

  const handleSkip = (direction: -1 | 1) => {
    if (!currentTrack || queue.length === 0) {
      return
    }

    const currentIndex = queue.findIndex(
      (track) => track.id === currentTrack.id
    )

    if (currentIndex === -1) {
      setCurrentTrack(queue[0] ?? null)
      return
    }

    const nextIndex = (currentIndex + direction + queue.length) % queue.length
    setCurrentTrack(queue[nextIndex] ?? null)
  }

  return (
    <footer className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/84 text-foreground shadow-[0_-18px_62px_rgba(0,0,0,0.5)] backdrop-blur-xl">
      {currentTrack?.audioUrl ? (
        <audio
          ref={audioRef}
          src={currentTrack.audioUrl}
          onEnded={() => setIsPlaying(false)}
          onTimeUpdate={handleTimeUpdate}
        />
      ) : null}
      <div className="mx-auto grid w-full max-w-7xl grid-cols-[minmax(0,1fr)_auto] gap-3 px-4 py-3 sm:px-6 lg:grid-cols-[1fr_auto_1fr] lg:items-center lg:px-8">
        <div className="min-w-0 rounded-[3px] border border-border bg-surface/80 px-4 py-3 shadow-[inset_0_1px_0_rgba(238,244,237,0.05)]">
          <div className="flex items-center gap-3">
            <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-[3px] border border-border bg-muted/45 shadow-inner shadow-black/30">
              {currentTrack?.videoStatus === "completed" && currentTrack.videoUrl ? (
                <video
                  src={currentTrack.videoUrl}
                  poster={currentTrack.coverUrl || undefined}
                  className="size-full object-cover"
                  autoPlay
                  muted
                  loop
                  playsInline
                />
              ) : currentTrack?.coverUrl ? (
                <img
                  src={currentTrack.coverUrl}
                  alt={currentTrack.title}
                  className="size-full object-cover"
                />
              ) : (
                <div className="flex size-8 items-center justify-center rounded-[2px] border border-acid/45 bg-acid/12 font-mono text-[10px] font-black text-acid">
                  AI
                </div>
              )}
            </div>
            <div className="min-w-0">
              <div className="mb-1 flex items-center gap-2">
                <span className="status-dot" />
                <span className="terminal-label">signal ready</span>
              </div>
              <p className="truncate text-sm font-semibold text-foreground">
                {currentTrack?.title ?? "No track selected"}
              </p>
              {currentTrack?.videoStatus &&
              currentTrack.videoStatus !== "completed" ? (
                <p className="font-mono text-[10px] font-bold tracking-[0.14em] text-cyan uppercase">
                  {currentTrack.videoStatus === "failed"
                    ? "video unavailable"
                    : "video rendering"}
                </p>
              ) : null}
            </div>
          </div>
        </div>

        <div className="col-span-2 flex w-full max-w-3xl flex-col items-center gap-2 justify-self-center rounded-[3px] border border-border bg-surface/80 px-4 py-3 shadow-[inset_0_1px_0_rgba(238,244,237,0.06),0_14px_34px_rgba(0,0,0,0.34),0_0_22px_rgba(122,184,176,0.07)] lg:col-span-1 lg:min-w-[28rem]">
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="size-8 rounded-md text-foreground hover:text-primary"
              aria-label="Previous track"
              onClick={() => handleSkip(-1)}
              disabled={queue.length < 2}
            >
              <SkipBack className="size-4" />
            </Button>
            <Button
              size="icon"
              className="size-10 rounded-md"
              aria-label={isPlaying ? "Pause" : "Play"}
              onClick={handlePlayToggle}
              disabled={!currentTrack?.audioUrl}
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
              onClick={() => handleSkip(1)}
              disabled={queue.length < 2}
            >
              <SkipForward className="size-4" />
            </Button>
          </div>

          <div className="flex w-full items-center gap-3 font-mono text-[11px] text-muted-foreground">
            <span>{formatProgressTime(currentTime)}</span>
            <Slider
              value={progress}
              onValueChange={handleProgressChange}
              aria-label="Track progress"
              className="[&_[data-slot=slider-range]]:bg-acid [&_[data-slot=slider-thumb]]:border-acid/80 [&_[data-slot=slider-thumb]]:bg-background [&_[data-slot=slider-thumb]]:shadow-[0_0_14px_rgba(183,214,106,0.3)] [&_[data-slot=slider-track]]:bg-acid/16"
            />
            <span>{currentTrack?.duration ?? "--"}</span>
          </div>
          {audioError ? (
            <p className="font-mono text-[10px] font-bold tracking-[0.18em] text-destructive uppercase">
              {audioError}
            </p>
          ) : null}
        </div>

        <div className="flex items-center gap-3 rounded-[3px] border border-border bg-surface/80 px-3 py-3 shadow-[inset_0_1px_0_rgba(238,244,237,0.05)] lg:justify-self-end lg:px-4">
          <div
            className="hidden h-6 items-end gap-0.5 sm:flex"
            aria-hidden="true"
          >
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

function formatProgressTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return "0:00"
  }

  const wholeSeconds = Math.floor(seconds)
  const minutes = Math.floor(wholeSeconds / 60)
  const remainingSeconds = wholeSeconds % 60

  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`
}
