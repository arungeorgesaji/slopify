import { useEffect, useRef, useState } from "react"
import { Outlet, useNavigate, useRouterState } from "@tanstack/react-router"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { MusicPlayer } from "@/components/music-player"
import { SlopifyAppContext } from "@/components/slopify-app-context"
import { cn } from "@/lib/utils"
import { DEFAULT_TRACK } from "@/lib/mock-tracks"

export function SlopifyShell() {
  const [search, setSearch] = useState("")
  const [currentTrack, setCurrentTrack] = useState(DEFAULT_TRACK)
  const desktopSearchRef = useRef<HTMLInputElement | null>(null)
  const mobileSearchRef = useRef<HTMLInputElement | null>(null)
  const navigate = useNavigate()
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
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

  return (
    <SlopifyAppContext.Provider
      value={{ currentTrack, search, setCurrentTrack }}
    >
      <div className="min-h-svh bg-background">
        {isCreatePage ? null : (
          <header className="fixed inset-x-0 top-0 z-40 border-b border-primary/80 bg-primary text-primary-foreground shadow-lg shadow-primary/20">
            <div className="mx-auto flex h-20 w-full max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
              <button
                type="button"
                onClick={() => navigate({ to: "/" })}
                className="min-w-0 text-left text-2xl font-bold tracking-tight sm:flex-none sm:text-3xl"
              >
                Slopify
              </button>
              <div className="hidden min-w-0 flex-1 sm:block">
                <div className="mx-auto w-full max-w-2xl">
                  <div className="relative">
                    <Input
                      ref={desktopSearchRef}
                      aria-label="Search tracks"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Search AI tracks"
                      className="h-14 rounded-xl border-white/30 bg-white/15 px-5 pr-18 text-lg text-primary-foreground placeholder:text-primary-foreground/70"
                    />
                    <span className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 rounded-md border border-white/25 bg-white/10 px-2 py-1 text-xs font-medium text-primary-foreground/80">
                      ⌘K
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  variant="secondary"
                  className="h-10 rounded-lg border border-white/25 bg-white/12 px-5 text-primary-foreground hover:bg-white/18"
                >
                  Surprise Me
                </Button>
                <Button
                  className="h-10 rounded-lg bg-white px-5 text-primary hover:bg-white/90"
                  onClick={() => navigate({ to: "/create" })}
                >
                  Create
                </Button>
              </div>
            </div>
            <div className="border-t border-white/10 px-4 py-3 sm:hidden">
              <Input
                ref={mobileSearchRef}
                aria-label="Search tracks"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search AI tracks"
                className="h-10 rounded-xl border-white/30 bg-white/15 px-4 text-primary-foreground placeholder:text-primary-foreground/70"
              />
            </div>
          </header>
        )}

        <main
          className={cn(
            "w-full px-4 sm:px-6 lg:px-8",
            isCreatePage ? "h-svh overflow-hidden py-4" : "pt-28 pb-44"
          )}
        >
          <Outlet />
        </main>

        {isCreatePage ? null : <MusicPlayer />}
      </div>
    </SlopifyAppContext.Provider>
  )
}
