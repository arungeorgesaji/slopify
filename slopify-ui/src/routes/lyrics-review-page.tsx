import { useEffect, useState, type FormEvent } from "react"
import { useNavigate, useParams } from "@tanstack/react-router"
import { Image as ImageIcon, Loader2, RefreshCcw } from "lucide-react"
import {
  buildMusicPrompt,
  formatCreateDuration,
  loadCreateDraft,
  saveCreateDraft,
  type CreateDraft,
} from "@/lib/create-flow"
import {
  generateCoverImage,
  generateLyrics,
  generateSongSession,
} from "@/lib/song-sessions"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

const MAX_LYRICS_LENGTH = 10000

export function LyricsReviewPage() {
  const { draftId } = useParams({ from: "/create/lyrics/$draftId" })
  const initialDraft = loadCreateDraft(draftId)
  const [draft, setDraft] = useState<CreateDraft | null>(initialDraft)
  const [lyrics, setLyrics] = useState(initialDraft?.lyrics ?? "")
  const [feedback, setFeedback] = useState<string | null>(null)
  const [isRetrying, setIsRetrying] = useState(false)
  const [isRefreshingCover, setIsRefreshingCover] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const navigate = useNavigate()
  const coverImageUrl =
    draft?.coverImageBase64 && draft.coverImageMimeType
      ? `data:${draft.coverImageMimeType};base64,${draft.coverImageBase64}`
      : ""

  useEffect(() => {
    if (!draft || draft.coverImageBase64 || isRefreshingCover) {
      return
    }

    void refreshCoverImage(draft, {
      lyrics,
      setDraft,
      setFeedback,
      setIsRefreshingCover,
      shouldAnnounceStart: false,
    })
  }, [draft, isRefreshingCover, lyrics])

  const handleRetryLyrics = async () => {
    if (!draft) {
      setFeedback("Draft was not found. Go back and create lyrics again.")
      return
    }

    setIsRetrying(true)
    setFeedback("Retrying lyrics with the same prompt and options.")

    try {
      const nextLyrics = await generateLyrics(draft.enrichedPrompt)
      const nextDraft = { ...draft, lyrics: nextLyrics }

      setDraft(nextDraft)
      setLyrics(nextLyrics)
      saveCreateDraft(nextDraft)
      setFeedback("Lyrics regenerated. Review or edit before generating music.")
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown lyrics error"

      setFeedback(`Lyrics retry failed: ${errorMessage}`)
    } finally {
      setIsRetrying(false)
    }
  }

  const handleRefreshCover = async () => {
    if (!draft) {
      setFeedback("Draft was not found. Go back and create lyrics again.")
      return
    }

    await refreshCoverImage(draft, {
      lyrics,
      setDraft,
      setFeedback,
      setIsRefreshingCover,
      shouldAnnounceStart: true,
    })
  }

  const handleGenerateSong = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!draft) {
      setFeedback("Draft was not found. Go back and create lyrics again.")
      return
    }

    const trimmedLyrics = lyrics.trim()

    if (trimmedLyrics.length === 0) {
      setFeedback("Add lyrics before generating music.")
      return
    }

    if (trimmedLyrics.length > MAX_LYRICS_LENGTH) {
      setFeedback(`Keep lyrics under ${MAX_LYRICS_LENGTH} characters.`)
      return
    }

    setIsGenerating(true)
    setFeedback("Generating two music variations from approved lyrics.")

    try {
      const enrichedPrompt = buildMusicPrompt(draft.prompt, draft.options)
      const session = await generateSongSession({
        prompt: enrichedPrompt,
        lyrics: trimmedLyrics,
        durationMs: draft.options.durationMs,
        coverImageBase64: draft.coverImageBase64,
        coverImageMimeType: draft.coverImageMimeType,
      })

      saveCreateDraft({
        ...draft,
        enrichedPrompt,
        lyrics: trimmedLyrics,
      })

      void navigate({
        to: "/create/$sessionId",
        params: { sessionId: session.id },
      })
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown generation error"

      setFeedback(`Music generation failed: ${errorMessage}`)
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <section className="relative flex min-h-[calc(100svh-3rem)] items-center justify-center overflow-hidden py-10">
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

      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 pt-10">
        <div className="text-center">
          <p className="terminal-label">lyric checkpoint / manual control</p>
          <h1 className="mt-2 text-4xl font-black tracking-[-0.04em] text-foreground sm:text-6xl">
            Review lyrics
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm text-muted-foreground">
            Retry the lyrics, edit them manually, then generate music only when
            the words are ready.
          </p>
        </div>

        {!draft ? (
          <div className="mx-auto w-full max-w-3xl rounded-[4px] border border-destructive/45 bg-destructive/10 px-5 py-4 text-sm text-destructive">
            Draft not found. Go back to create a new prompt.
          </div>
        ) : (
          <form
            onSubmit={handleGenerateSong}
            className="grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]"
          >
            <div className="hud-panel rounded-[6px] p-3">
              <div className="flex items-center justify-between border-b border-border px-3 pb-3">
                <span className="terminal-label">editable lyrics</span>
                <span className="font-mono text-[10px] font-bold tracking-[0.18em] text-cyan uppercase">
                  {lyrics.length}/{MAX_LYRICS_LENGTH}
                </span>
              </div>
              <Textarea
                value={lyrics}
                maxLength={MAX_LYRICS_LENGTH}
                onChange={(event) => {
                  setLyrics(event.target.value)
                  setFeedback(null)
                }}
                className="max-h-[520px] min-h-[420px] resize-none overflow-y-auto rounded-[3px] border-0 bg-background/35 px-5 py-5 text-base leading-8 shadow-[inset_0_1px_0_rgba(238,244,237,0.04),inset_0_0_28px_rgba(0,0,0,0.24)] focus-visible:ring-0"
              />
              <div className="flex flex-col gap-3 border-t border-border px-3 pt-3 sm:flex-row sm:items-center sm:justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="lg"
                  className="h-11 rounded-[3px] px-5"
                  onClick={() => void handleRetryLyrics()}
                  disabled={isRetrying || isGenerating || isRefreshingCover}
                >
                  {isRetrying ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <RefreshCcw className="size-4" />
                  )}
                  Retry Lyrics
                </Button>
                <Button
                  type="submit"
                  size="lg"
                  className="h-11 rounded-[3px] px-7"
                  disabled={isRetrying || isGenerating || isRefreshingCover}
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    "Generate Music"
                  )}
                </Button>
              </div>
            </div>

            <aside className="space-y-5">
              <div className="hud-panel rounded-[6px] p-4">
                <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
                  <p className="terminal-label">cover art preview</p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-9 rounded-[3px] px-3"
                    onClick={() => void handleRefreshCover()}
                    disabled={isGenerating || isRetrying || isRefreshingCover}
                  >
                    {isRefreshingCover ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <RefreshCcw className="size-4" />
                    )}
                    {isRefreshingCover ? "Refreshing..." : "Refresh Cover"}
                  </Button>
                </div>
                <div className="pt-4">
                  {coverImageUrl ? (
                    <div className="overflow-hidden rounded-[4px] border border-border bg-background/35 shadow-[inset_0_1px_0_rgba(238,244,237,0.04)]">
                      <img
                        src={coverImageUrl}
                        alt="Generated cover preview"
                        className="aspect-square w-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="flex aspect-square items-center justify-center rounded-[4px] border border-dashed border-border bg-background/25 px-6 text-center text-sm text-muted-foreground">
                      <div className="space-y-3">
                        <ImageIcon className="mx-auto size-8 text-acid" />
                        <p>
                          {isRefreshingCover
                            ? "Generating cover art from your prompt and lyrics."
                            : "Generate cover art before sending the final session to music generation."}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="hud-panel rounded-[6px] p-4">
                <div className="border-b border-border pb-3">
                  <p className="terminal-label">generation brief</p>
                </div>
                <div className="space-y-4 pt-4 text-sm text-muted-foreground">
                <BriefItem label="Prompt" value={draft.prompt} />
                <BriefItem label="Voice" value={draft.options.vocalDirection} />
                <BriefItem label="Type" value={draft.options.songType} />
                <BriefItem label="Energy" value={draft.options.energy} />
                <BriefItem label="Language" value={draft.options.language} />
                <BriefItem
                  label="Duration"
                  value={formatCreateDuration(draft.options.durationMs)}
                />
                <BriefItem label="Structure" value={draft.options.structure} />
                <BriefItem
                  label="Instrumentation"
                  value={draft.options.instrumentation}
                />
                <BriefItem label="Delivery" value={draft.options.delivery} />
                </div>
              </div>
            </aside>
          </form>
        )}

        {feedback ? (
          <div className="mx-auto rounded-[3px] border border-border bg-background/70 px-4 py-2 text-center font-mono text-xs font-bold tracking-[0.08em] text-muted-foreground uppercase shadow-[inset_0_1px_0_rgba(238,244,237,0.04)]">
            {feedback}
          </div>
        ) : null}
      </div>
    </section>
  )
}

function BriefItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-mono text-[10px] font-bold tracking-[0.18em] text-acid uppercase">
        {label}
      </p>
      <p className="mt-1 leading-6 text-foreground">{value}</p>
    </div>
  )
}

async function refreshCoverImage(
  draft: CreateDraft,
  {
    lyrics,
    setDraft,
    setFeedback,
    setIsRefreshingCover,
    shouldAnnounceStart,
  }: {
    lyrics: string
    setDraft: (draft: CreateDraft) => void
    setFeedback: (message: string | null) => void
    setIsRefreshingCover: (value: boolean) => void
    shouldAnnounceStart: boolean
  }
) {
  setIsRefreshingCover(true)
  if (shouldAnnounceStart) {
    setFeedback("Refreshing cover art from the current prompt and lyrics.")
  }

  try {
    const cover = await generateCoverImage({
      title: draft.prompt,
      prompt: draft.enrichedPrompt,
      lyrics: lyrics.trim() || draft.lyrics,
    })

    const nextDraft = {
      ...draft,
      lyrics,
      coverImageBase64: cover.imageBase64,
      coverImageMimeType: cover.mimeType,
    }

    setDraft(nextDraft)
    saveCreateDraft(nextDraft)
    setFeedback("Cover art refreshed. The current image will be saved with the music session.")
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown cover image error"

    setFeedback(`Cover image generation failed: ${errorMessage}`)
  } finally {
    setIsRefreshingCover(false)
  }
}
