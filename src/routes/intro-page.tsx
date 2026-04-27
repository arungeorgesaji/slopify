import { useEffect, useState } from "react"
import { useNavigate } from "@tanstack/react-router"
import { ArrowRight, RadioTower } from "lucide-react"
import { Button } from "@/components/ui/button"

const INTRO_SUBTITLES = [
  "turning one bad situationship prompt into a chorus your friends will unfortunately quote",
  "generating the soundtrack for being left on delivered by someone with a podcast",
  "for when your group chat drama needs a bridge, a beat drop, and legal supervision",
  "making fake-deep lyrics for people who say 'this one's different' every two weeks",
  "premium audio trash for villain arcs that started in a notes app",
  "rendering emotionally unstable hooks from delusion, caffeine, and weak Wi-Fi",
  "because your most questionable life choices deserve suspiciously catchy production",
  "the AI music machine for breakup theories, soft launches, and main character damage",
  "converting chronically online thoughts into songs nobody requested but everyone replays",
  "building an anthem for the exact moment you overthink a three-word text reply",
  "where corporate despair, bedroom pop, and unpaid group projects become radio-ready",
  "feeding your intrusive thoughts into a synth engine with no adult supervision",
]

export function IntroPage() {
  const [subtitleIndex, setSubtitleIndex] = useState(0)
  const navigate = useNavigate()

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches

    if (prefersReducedMotion) {
      return
    }

    const interval = window.setInterval(() => {
      setSubtitleIndex((current) => (current + 1) % INTRO_SUBTITLES.length)
    }, 4200)

    return () => {
      window.clearInterval(interval)
    }
  }, [])

  return (
    <main className="intro-screen isolate min-h-svh overflow-hidden px-5 py-6 text-intro-text">
      <div className="intro-light-sweep" aria-hidden="true" />
      <div className="intro-wave-grid" aria-hidden="true" />
      <div className="intro-hud intro-hud-left hidden md:block">
        <span>AUDIO CORE ONLINE</span>
        <span>SIGNAL PATH OPEN</span>
      </div>
      <div className="intro-hud intro-hud-right hidden md:block">
        <span>ENTRY NODE READY</span>
        <span>OUTPUT BUS IDLE</span>
      </div>

      <section className="relative z-10 mx-auto flex min-h-[calc(100svh-3rem)] w-full max-w-6xl flex-col items-center justify-center text-center">
        <div className="intro-orbit mb-8" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>

        <p className="intro-kicker">SYNTH MEMORY WARM</p>
        <h1 className="intro-title">Slopify</h1>

        <div className="mt-5 flex min-h-16 items-center justify-center px-2 sm:min-h-12">
          <p key={subtitleIndex} className="intro-subtitle">
            {INTRO_SUBTITLES[subtitleIndex]}
          </p>
        </div>

        <div className="mt-8 flex flex-col items-center gap-3">
          <Button
            type="button"
            className="intro-enter h-12 rounded-[3px] px-7 text-sm"
            onClick={() => navigate({ to: "/app" })}
          >
            <RadioTower className="size-4" />
            Enter Slopify
            <ArrowRight className="size-4" />
          </Button>
          <div className="flex items-center gap-2 font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-intro-muted">
            <span className="intro-status-dot" />
            signal ready
          </div>
        </div>

        <div className="intro-wave" aria-hidden="true">
          {Array.from({ length: 42 }, (_, index) => (
            <span
              key={index}
              style={{
                animationDelay: `${index * 0.045}s`,
                height: `${12 + (index % 9) * 4}px`,
              }}
            />
          ))}
        </div>
      </section>
    </main>
  )
}
