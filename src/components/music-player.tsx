import { memo, useCallback, useEffect, useRef, useState } from "react"
import { Pause, Play, SkipBack, SkipForward, Volume2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { useSlopifyPlayback } from "@/components/slopify-app-context"
import { refreshTrack } from "@/lib/tracks"

export const MusicPlayer = memo(function MusicPlayer() {
  const {
    currentTrack,
    pauseRequestId,
    playRequestId,
    queue,
    setCurrentTime: setSharedCurrentTime,
    setCurrentTrack,
    setIsPlaying: setSharedIsPlaying,
    setQueue,
  } = useSlopifyPlayback()
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const lastSharedTimeUpdateRef = useRef(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [progress, setProgress] = useState([0])
  const [currentTime, setLocalCurrentTime] = useState(0)
  const [volume, setVolume] = useState([72])
  const [audioError, setAudioError] = useState<string | null>(null)
  const currentAudioUrl = currentTrack?.audioUrl ?? null

  useEffect(() => {
    audioRef.current?.pause()
    audioRef.current?.load()

    const resetTimer = window.setTimeout(() => {
      lastSharedTimeUpdateRef.current = 0
      setIsPlaying(false)
      setProgress([0])
      setLocalCurrentTime(0)
      setSharedCurrentTime(0)
      setSharedIsPlaying(false)
      setAudioError(null)
    }, 0)

    return () => window.clearTimeout(resetTimer)
  }, [currentAudioUrl, setSharedCurrentTime, setSharedIsPlaying])

  useEffect(() => {
    if (playRequestId === 0 || !currentTrack?.audioUrl) {
      return
    }

    const playTimer = window.setTimeout(() => {
      if (!audioRef.current) {
        return
      }

      void audioRef.current
        .play()
        .then(() => {
          setAudioError(null)
          setIsPlaying(true)
          setSharedIsPlaying(true)
        })
        .catch(() => {
          setIsPlaying(false)
          setSharedIsPlaying(false)
          setAudioError("Audio failed")
        })
    }, 0)

    return () => window.clearTimeout(playTimer)
  }, [currentTrack?.audioUrl, playRequestId, setSharedIsPlaying])

  useEffect(() => {
    if (pauseRequestId === 0) {
      return
    }

    audioRef.current?.pause()
    setIsPlaying(false)
    setSharedIsPlaying(false)
  }, [pauseRequestId, setSharedIsPlaying])

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
      setLocalCurrentTime(nextCurrentTime)
      setSharedCurrentTime(nextCurrentTime)
    }
  }

  const handleVolumeChange = (value: number | readonly number[]) => {
    setVolume(Array.isArray(value) ? [...value] : [value])
  }

  const syncPlaybackPosition = useCallback(() => {
    if (!audioRef.current || !Number.isFinite(audioRef.current.duration)) {
      return
    }

    const nextCurrentTime = audioRef.current.currentTime

    setLocalCurrentTime(nextCurrentTime)
    setProgress([(nextCurrentTime / audioRef.current.duration) * 100])

    const now = performance.now()
    if (now - lastSharedTimeUpdateRef.current >= 250) {
      lastSharedTimeUpdateRef.current = now
      setSharedCurrentTime(nextCurrentTime)
    }
  }, [setSharedCurrentTime])

  const handlePlayToggle = () => {
    if (!audioRef.current || !currentTrack?.audioUrl) {
      return
    }

    if (isPlaying) {
      audioRef.current.pause()
      setIsPlaying(false)
      setSharedIsPlaying(false)
      return
    }

    void audioRef.current
      .play()
      .then(() => {
        setAudioError(null)
        setIsPlaying(true)
        setSharedIsPlaying(true)
      })
      .catch(() => {
        setIsPlaying(false)
        setSharedIsPlaying(false)
        setAudioError("Audio failed")
      })
  }

  const handleTimeUpdate = () => {
    syncPlaybackPosition()
  }

  useEffect(() => {
    if (!isPlaying) {
      return
    }

    const intervalId = window.setInterval(syncPlaybackPosition, 250)

    return () => window.clearInterval(intervalId)
  }, [isPlaying, syncPlaybackPosition])

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
    <footer className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/88 text-foreground shadow-[0_-10px_34px_rgba(0,0,0,0.42)] backdrop-blur-md">
      {currentTrack?.audioUrl ? (
        <audio
          ref={audioRef}
          src={currentTrack.audioUrl}
          onEnded={() => {
            setIsPlaying(false)
            setSharedIsPlaying(false)
            setLocalCurrentTime(0)
            setSharedCurrentTime(0)
            setProgress([0])
          }}
          onLoadedMetadata={syncPlaybackPosition}
          onTimeUpdate={handleTimeUpdate}
        />
      ) : null}
      <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-2 px-4 py-2 sm:px-6 md:grid-cols-[minmax(260px,420px)_minmax(360px,520px)_minmax(180px,260px)] md:items-center md:justify-center lg:px-8">
        <div className="flex h-20 min-w-0 items-center rounded-[3px] border border-border bg-surface/80 px-4 shadow-[inset_0_1px_0_rgba(238,244,237,0.05)]">
          <div className="flex items-center gap-3">
            <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-[3px] border border-border bg-muted/45 shadow-inner shadow-black/30">
              {currentTrack?.coverUrl ? (
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
              currentTrack.videoStatus !== "completed" &&
              currentTrack.videoStatus !== "failed" ? (
                <p className="font-mono text-[10px] font-bold tracking-[0.14em] text-cyan uppercase">
                  video rendering
                </p>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex h-20 min-w-0 flex-col items-center justify-center gap-2 rounded-[3px] border border-border bg-surface/80 px-4 shadow-[inset_0_1px_0_rgba(238,244,237,0.06),0_14px_34px_rgba(0,0,0,0.34),0_0_22px_rgba(122,184,176,0.07)]">
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

        <div className="flex h-20 items-center justify-center gap-3 rounded-[3px] border border-border bg-surface/80 px-4 shadow-[inset_0_1px_0_rgba(238,244,237,0.05)]">
          <Volume2 className="size-4 shrink-0 text-cyan" />
          <div className="w-full min-w-28">
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
})

function formatProgressTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return "0:00"
  }

  const wholeSeconds = Math.floor(seconds)
  const minutes = Math.floor(wholeSeconds / 60)
  const remainingSeconds = wholeSeconds % 60

  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`
}
