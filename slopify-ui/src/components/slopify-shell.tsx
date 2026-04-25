import { useEffect, useRef, useState } from "react"
import { Outlet, useNavigate, useRouterState } from "@tanstack/react-router"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { MusicPlayer } from "@/components/music-player"
import { SlopifyAppContext } from "@/components/slopify-app-context"
import type { Track } from "@/lib/tracks"

export function SlopifyShell() {
  const [search, setSearch] = useState("")
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null)
  const desktopSearchRef = useRef<HTMLInputElement | null>(null)
  const mobileSearchRef = useRef<HTMLInputElement | null>(null)
  const navigate = useNavigate()
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  const isIntroPage = pathname === "/"
  const isCreatePage = pathname === "/create"

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        !(event.metaKey || event.ctrlKey) ||
        event.key.toLowerCase() !== "k"
      ) {
        return
      }

      event.preventDefault()

      const searchInput =
        window.innerWidth < 640
          ? mobileSearchRef.current
          : desktopSearchRef.current

      searchInput?.focus()
      searchInput?.select()
    }

    window.addEventListener("keydown", handleKeyDown)

    return () => {
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [])

  if (isIntroPage) {
    return <Outlet />
  }

  if (isCreatePage) {
    return (
      <SlopifyAppContext.Provider
        value={{ currentTrack, search, setCurrentTrack }}
      >
        <div className="min-h-svh bg-transparent">
          <main className="w-full px-4 pt-6 pb-10 sm:px-6 lg:px-8">
            <Outlet />
          </main>
        </div>
      </SlopifyAppContext.Provider>
    )
  }

  return (
    <SlopifyAppContext.Provider
      value={{ currentTrack, search, setCurrentTrack }}
    >
      <div className="min-h-svh bg-transparent">
        <header className="fixed inset-x-0 top-0 z-40 border-b border-border bg-background/82 text-foreground shadow-[0_14px_54px_rgba(0,0,0,0.5)] backdrop-blur-xl">
          <div className="mx-auto flex h-20 w-full max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
            <div className="min-w-0 flex-1 sm:flex-none">
              <p className="terminal-label hidden sm:block">
                audio core / slop ai
              </p>
              <div className="text-2xl font-black tracking-[-0.03em] text-foreground drop-shadow-[0_0_18px_rgba(183,214,106,0.18)] sm:text-3xl">
                Slopify
              </div>
            </div>
            <div className="hidden min-w-0 flex-1 sm:block">
              <div className="mx-auto w-full max-w-2xl">
                <div className="relative">
                  <Input
                    ref={desktopSearchRef}
                    aria-label="Search tracks"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search tracks, signals, synthetic hooks"
                    className="h-14 rounded-[3px] border-border bg-surface/90 px-5 pr-20 font-mono text-base text-foreground placeholder:text-muted-foreground"
                  />
                  <span className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 rounded-[2px] border border-cyan/35 bg-background/80 px-2 py-1 font-mono text-[10px] font-bold text-cyan">
                    CTRL K
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <Button
                variant="secondary"
                className="h-10 rounded-md px-3 text-xs tracking-wide uppercase sm:px-5 sm:text-sm"
              >
                Surprise Me
              </Button>
              <Button
                className="h-10 rounded-md px-4 text-xs tracking-wide uppercase sm:px-5 sm:text-sm"
                onClick={() => navigate({ to: "/create" })}
              >
                Create
              </Button>
            </div>
          </div>
          <div className="border-t border-border px-4 py-3 sm:hidden">
            <Input
              ref={mobileSearchRef}
              aria-label="Search tracks"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search slop tracks"
              className="h-10 rounded-[3px] border-border bg-surface/90 px-4 font-mono"
            />
          </div>
        </header>

        <main className="w-full px-4 pt-28 pb-56 sm:px-6 lg:px-8">
          <Outlet />
        </main>

        <MusicPlayer />
      </div>
    </SlopifyAppContext.Provider>
  )
}
