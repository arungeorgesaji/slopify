import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useNavigate, useParams } from "@tanstack/react-router"
import { Check, Image as ImageIcon, Loader2 } from "lucide-react"
import { buildApiUrl } from "@/lib/api"
import { API_ENDPOINTS } from "@/lib/constants"
import {
  fetchSongSession,
  firstNumber,
  firstString,
  formatDuration,
  getVariantAudioUrl,
  getVariantIndex,
  getVariantLyrics,
  hasVariantAudio,
  isCompletedVariant,
  selectSongVariant,
  sortSongVariants,
  type SongVariantRecord,
} from "@/lib/song-sessions"
import { Button } from "@/components/ui/button"

export function CreateReviewPage() {
  const { sessionId } = useParams({ from: "/create/$sessionId" })
  const [approvingVariantId, setApprovingVariantId] = useState<string | null>(
    null
  )
  const [feedback, setFeedback] = useState<string | null>(null)
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const {
    data: session,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["song-session", sessionId],
    queryFn: () => fetchSongSession(sessionId),
    refetchInterval: (query) => {
      const session = query.state.data
      const status = firstString(session?.status)

      if (!session || status === "processing" || status === "partial") {
        return 5000
      }

      return false
    },
  })

  const variants = session ? sortSongVariants(session.variants) : []
  const lyrics = session ? getVariantLyrics(session, variants[0]) : ""
  const coverUrl =
    session &&
    firstString(session.image_storage_path, session.imageStoragePath) &&
    firstString(session.image_mime_type, session.imageMimeType)
      ? buildApiUrl(API_ENDPOINTS.songSessionImage(session.id))
      : ""

  const handleApprove = async (variant: SongVariantRecord) => {
    if (!session) {
      return
    }

    setApprovingVariantId(variant.id)
    setFeedback("Adding selected variation to your album.")

    try {
      await selectSongVariant(session.id, variant.id)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["tracks"] }),
        queryClient.invalidateQueries({
          queryKey: ["song-session", sessionId],
        }),
      ])
      void navigate({ to: "/app" })
    } catch (approvalError) {
      const errorMessage =
        approvalError instanceof Error
          ? approvalError.message
          : "Unknown approval error"

      setFeedback(`Could not add variation: ${errorMessage}`)
    } finally {
      setApprovingVariantId(null)
    }
  }

  return (
    <section className="relative min-h-[calc(100svh-3rem)] overflow-hidden py-10">
      <div className="absolute top-0 right-0 z-10 flex gap-2">
        <Button
          type="button"
          variant="ghost"
          className="h-10 rounded-[3px] px-5"
          onClick={() => navigate({ to: "/create" })}
        >
          Back
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="h-10 rounded-[3px] px-5"
          onClick={() => navigate({ to: "/app" })}
        >
          Library
        </Button>
      </div>

      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 pt-10">
        <div className="text-center">
          <p className="terminal-label">generation review / choose output</p>
          <h1 className="mt-2 text-4xl font-black tracking-[-0.04em] text-foreground sm:text-6xl">
            Pick your variation
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm text-muted-foreground">
            Preview each generated track, read the returned lyrics or prompt,
            then approve one to add it to your album.
          </p>
        </div>

        {isLoading ? (
          <div className="hud-panel mx-auto flex w-full max-w-3xl items-center justify-center gap-3 rounded-[5px] px-6 py-10 font-mono text-sm font-bold tracking-[0.12em] text-muted-foreground uppercase">
            <Loader2 className="size-5 animate-spin text-acid" />
            Loading variations
          </div>
        ) : null}

        {error ? (
          <div className="mx-auto w-full max-w-3xl rounded-[4px] border border-destructive/45 bg-destructive/10 px-5 py-4 text-sm text-destructive">
            {error instanceof Error
              ? error.message
              : "Could not load generated variations."}
          </div>
        ) : null}

        {feedback ? (
          <div className="mx-auto rounded-[3px] border border-border bg-background/70 px-4 py-2 text-center font-mono text-xs font-bold tracking-[0.08em] text-muted-foreground uppercase shadow-[inset_0_1px_0_rgba(238,244,237,0.04)]">
            {feedback}
          </div>
        ) : null}

        {session ? (
          <>
            <div className="grid gap-5 lg:grid-cols-[minmax(280px,0.8fr)_minmax(0,1.2fr)]">
              <div className="hud-panel rounded-[5px] p-4">
                <div className="border-b border-border pb-3">
                  <p className="terminal-label">cover art</p>
                </div>
                <div className="pt-4">
                  {coverUrl ? (
                    <div className="overflow-hidden rounded-[4px] border border-border bg-background/35">
                      <img
                        src={coverUrl}
                        alt="Generated cover art"
                        className="aspect-square w-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="flex aspect-square items-center justify-center rounded-[4px] border border-dashed border-border bg-background/25 px-6 text-center text-sm text-muted-foreground">
                      <div className="space-y-3">
                        <ImageIcon className="mx-auto size-8 text-acid" />
                        <p>Cover art is still syncing to the session.</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="hud-panel rounded-[5px] p-4">
                <div className="border-b border-border pb-3">
                  <p className="terminal-label">lyric sheet</p>
                </div>
                <div className="max-h-[360px] overflow-y-auto pt-4">
                  <div className="slop-sheet rounded-[3px] border border-border-strong px-5 py-5">
                    {lyrics.split("\n\n").map((section, sectionIndex) => (
                      <div key={sectionIndex} className="mb-5 last:mb-0">
                        {section.split("\n").map((line, lineIndex) => (
                          <p
                            key={lineIndex}
                            className="text-base leading-8 font-semibold text-foreground"
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

            <div className="grid gap-5 lg:grid-cols-2">
              {variants.map((variant) => {
                const isCompleted = isCompletedVariant(variant)
                const canApprove = isCompleted && hasVariantAudio(variant)
                const audioUrl = canApprove ? getVariantAudioUrl(variant) : ""
                const isSelected = session.selected_variant_id === variant.id
                const isApproving = approvingVariantId === variant.id

                return (
                  <article
                    key={variant.id}
                    className={`hud-panel flex flex-col rounded-[5px] p-4 ${
                      isSelected ? "border-acid/70" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3 border-b border-border pb-4">
                      <div className="min-w-0">
                        <p className="terminal-label">
                          variation{" "}
                          {String(getVariantIndex(variant)).padStart(2, "0")}
                        </p>
                        <h2 className="mt-2 truncate text-2xl font-black tracking-[-0.02em]">
                          {firstString(variant.title, session.title) ||
                            "Generated track"}
                        </h2>
                      </div>
                      <span className="rounded-[3px] border border-border bg-background/60 px-2 py-1 font-mono text-[10px] font-black tracking-[0.14em] text-muted-foreground uppercase">
                        {firstString(variant.status) || "unknown"}
                      </span>
                    </div>

                    <div className="border-b border-border py-4">
                      {audioUrl ? (
                        <audio
                          controls
                          preload="none"
                          src={audioUrl}
                          className="h-10 w-full"
                        />
                      ) : (
                        <p className="rounded-[3px] border border-border bg-background/40 px-3 py-3 text-sm text-muted-foreground">
                          {firstString(variant.error_message) ||
                            "Audio is not available for this variation."}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-3 pt-4">
                      <span className="font-mono text-xs font-bold tracking-[0.14em] text-muted-foreground uppercase">
                        {formatDuration(firstNumber(variant.music_length_ms))}
                      </span>
                      <Button
                        type="button"
                        size="lg"
                        variant={isSelected ? "secondary" : "default"}
                        className="h-10 rounded-[3px] px-4"
                        onClick={() => void handleApprove(variant)}
                        disabled={!canApprove || isApproving || isSelected}
                      >
                        {isSelected ? (
                          <>
                            <Check className="size-4" />
                            Added
                          </>
                        ) : isApproving ? (
                          <>
                            <Loader2 className="size-4 animate-spin" />
                            Adding...
                          </>
                        ) : (
                          "Approve"
                        )}
                      </Button>
                    </div>
                  </article>
                )
              })}
            </div>
          </>
        ) : null}
      </div>
    </section>
  )
}
