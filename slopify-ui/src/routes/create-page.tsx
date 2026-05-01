import { useState, type FormEvent } from "react"
import { useNavigate } from "@tanstack/react-router"
import { Loader2, Sparkles } from "lucide-react"
import { buildApiUrl } from "@/lib/api"
import {
  buildMusicPrompt,
  CREATE_DURATION_MAX_MS,
  CREATE_DURATION_MIN_MS,
  CREATE_DURATION_STEP_MS,
  createDraftId,
  DEFAULT_CREATE_OPTIONS,
  DELIVERY_OPTIONS,
  ENERGY_OPTIONS,
  formatCreateDuration,
  INSTRUMENTATION_OPTIONS,
  LANGUAGE_OPTIONS,
  saveCreateDraft,
  SONG_TYPE_OPTIONS,
  STRUCTURE_OPTIONS,
  VOCAL_DIRECTION_OPTIONS,
  type CreateOptions,
} from "@/lib/create-flow"
import { API_ENDPOINTS } from "@/lib/constants"
import {
  buildGenerationHeaders,
  getStoredProviderKeys,
  hasRequiredGenerationKeys,
} from "@/lib/provider-keys"
import { generateLyrics, MAX_PROMPT_LENGTH } from "@/lib/song-sessions"
import { Button } from "@/components/ui/button"
import { ProviderKeysDialog } from "@/components/provider-keys-dialog"
import { Slider } from "@/components/ui/slider"
import { Textarea } from "@/components/ui/textarea"

const STARTER_PROMPT = `I'm coming down after a packed work week and driving alone through the city at night.
I want something reflective but still uplifting, with warm synths, a steady beat, and a chorus that feels hopeful.`
const ENHANCE_PROMPT_URL = buildApiUrl(API_ENDPOINTS.enhancePrompt)

export function CreatePage() {
  const [prompt, setPrompt] = useState("")
  const [options, setOptions] = useState<CreateOptions>(DEFAULT_CREATE_OPTIONS)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [isEnhancing, setIsEnhancing] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const navigate = useNavigate()

  const handleEnhance = async () => {
    if (!getStoredProviderKeys().openAIApiKey) {
      setFeedback("Add your OpenAI API key before using AI prompt enhancement.")
      return
    }

    setIsEnhancing(true)

    try {
      const shouldUseBackend =
        Boolean(ENHANCE_PROMPT_URL) && prompt.trim().length > 0
      const nextPrompt = shouldUseBackend
        ? await enhancePromptWithBackend(buildMusicPrompt(prompt, options))
        : buildEnhancedPrompt(prompt, options)

      setPrompt(nextPrompt.slice(0, MAX_PROMPT_LENGTH))
      setFeedback(
        prompt.trim().length === 0
          ? "Added a richer starter prompt you can refine."
          : shouldUseBackend
            ? "Prompt enhanced with the backend service."
            : "Expanded your idea into a more detailed music brief."
      )
    } catch {
      const nextPrompt = buildEnhancedPrompt(prompt, options)

      setPrompt(nextPrompt.slice(0, MAX_PROMPT_LENGTH))
      setFeedback(
        "Backend enhancement was unavailable, so a local fallback prompt was used."
      )
    } finally {
      setIsEnhancing(false)
    }
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const trimmedPrompt = prompt.trim()

    if (trimmedPrompt.length < 3) {
      setFeedback("Write at least 3 characters before generating lyrics.")
      return
    }

    if (trimmedPrompt.length > MAX_PROMPT_LENGTH) {
      setFeedback(`Keep the prompt under ${MAX_PROMPT_LENGTH} characters.`)
      return
    }

    setIsSubmitting(true)
    setFeedback("Writing lyrics from your prompt and options.")

    try {
      if (!hasRequiredGenerationKeys(getStoredProviderKeys())) {
        throw new Error(
          "Add both your OpenAI and ElevenLabs API keys before generating songs."
        )
      }

      const enrichedPrompt = buildMusicPrompt(trimmedPrompt, options)
      const lyrics = await generateLyrics(enrichedPrompt)
      const draftId = createDraftId()

      saveCreateDraft({
        id: draftId,
        prompt: trimmedPrompt,
        enrichedPrompt,
        lyrics,
        coverImageBase64: null,
        coverImageMimeType: null,
        options,
        createdAt: new Date().toISOString(),
      })

      void navigate({
        to: "/create/lyrics/$draftId",
        params: { draftId },
      })
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown lyrics error"

      setFeedback(`Lyrics generation failed: ${errorMessage}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="relative flex min-h-[calc(100svh-3rem)] items-start justify-center overflow-hidden py-6 sm:items-center">
      <div className="relative z-10 flex w-full max-w-6xl justify-center px-4 sm:absolute sm:top-0 sm:right-0 sm:justify-end sm:px-0">
        <div className="flex w-full flex-wrap justify-center gap-2 sm:w-auto sm:justify-end">
          <ProviderKeysDialog />
          <Button
            type="button"
            variant="ghost"
            className="h-10 rounded-[3px] px-5"
            onClick={() => navigate({ to: "/app" })}
          >
            Library
          </Button>
        </div>
      </div>

      <div className="relative flex w-full max-w-6xl flex-col items-center justify-center px-4 py-8 sm:py-12">
        <div className="mb-6 mt-4 text-center sm:mb-8 sm:mt-0">
          <p className="terminal-label">generation node / prompt uplink</p>
          <p className="mt-2 text-4xl font-black tracking-[-0.04em] text-foreground drop-shadow-[0_0_18px_rgba(183,214,106,0.16)] sm:text-7xl">
            Slopify
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="grid w-full gap-5"
        >
          <div className="hud-panel overflow-hidden rounded-[6px] p-3">
            <div className="flex items-center justify-between border-b border-border px-3 pb-3">
              <span className="terminal-label">audio request input</span>
              <span className="font-mono text-[10px] font-bold tracking-[0.18em] text-cyan uppercase">
                {prompt.length}/{MAX_PROMPT_LENGTH}
              </span>
            </div>
            <Textarea
              value={prompt}
              maxLength={MAX_PROMPT_LENGTH}
              onChange={(event) => {
                setPrompt(event.target.value)
                setFeedback(null)
              }}
              placeholder="Describe your situation, mood, and the kind of music you want."
              className="max-h-[300px] min-h-[220px] resize-none overflow-y-auto rounded-[3px] border-0 bg-background/35 px-4 py-4 text-base leading-7 shadow-[inset_0_1px_0_rgba(238,244,237,0.04),inset_0_0_28px_rgba(0,0,0,0.24)] focus-visible:ring-0 sm:min-h-[250px] sm:px-5 sm:py-5 sm:text-xl sm:leading-8"
            />

            <div className="flex flex-col gap-3 border-t border-border px-3 pt-3 sm:flex-row sm:items-center sm:justify-end">
              <Button
                type="button"
                variant="ghost"
                size="lg"
                className="h-11 rounded-[3px] px-5"
                onClick={() => void handleEnhance()}
                disabled={isEnhancing || isSubmitting}
              >
                {isEnhancing ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Sparkles className="size-4" />
                )}
                {isEnhancing ? "Tuning Signal..." : "Enhance With AI"}
              </Button>
              <Button
                type="submit"
                size="lg"
                className="h-11 rounded-[3px] px-7"
                disabled={isSubmitting || isEnhancing}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Writing Lyrics...
                  </>
                ) : (
                  "Create Lyrics"
                )}
              </Button>
            </div>
          </div>

          <div className="hud-panel rounded-[6px] p-4">
            <div className="border-b border-border pb-3">
              <p className="terminal-label">song options</p>
            </div>
            <div className="space-y-5 pt-4">
              <OptionGroup
                label="Vocal direction"
                value={options.vocalDirection}
                options={VOCAL_DIRECTION_OPTIONS}
                onChange={(value) =>
                  setOptions((current) => ({
                    ...current,
                    vocalDirection: value,
                  }))
                }
              />
              <OptionGroup
                label="Song type"
                value={options.songType}
                options={SONG_TYPE_OPTIONS}
                onChange={(value) =>
                  setOptions((current) => ({ ...current, songType: value }))
                }
              />
              <OptionGroup
                label="Energy"
                value={options.energy}
                options={ENERGY_OPTIONS}
                onChange={(value) =>
                  setOptions((current) => ({ ...current, energy: value }))
                }
              />
              <OptionGroup
                label="Vocal language"
                value={options.language}
                options={LANGUAGE_OPTIONS}
                onChange={(value) =>
                  setOptions((current) => ({ ...current, language: value }))
                }
              />
              <DurationSlider
                value={options.durationMs}
                onChange={(value) =>
                  setOptions((current) => ({ ...current, durationMs: value }))
                }
              />
              <OptionGroup
                label="Structure"
                value={options.structure}
                options={STRUCTURE_OPTIONS}
                onChange={(value) =>
                  setOptions((current) => ({ ...current, structure: value }))
                }
              />
              <OptionGroup
                label="Instrumentation"
                value={options.instrumentation}
                options={INSTRUMENTATION_OPTIONS}
                onChange={(value) =>
                  setOptions((current) => ({
                    ...current,
                    instrumentation: value,
                  }))
                }
              />
              <OptionGroup
                label="Delivery"
                value={options.delivery}
                options={DELIVERY_OPTIONS}
                onChange={(value) =>
                  setOptions((current) => ({ ...current, delivery: value }))
                }
              />
            </div>
          </div>
        </form>

        {feedback ? (
          <div className="mt-5 rounded-[3px] border border-border bg-background/70 px-4 py-2 text-center font-mono text-xs font-bold tracking-[0.08em] text-muted-foreground uppercase shadow-[inset_0_1px_0_rgba(238,244,237,0.04)]">
            {feedback}
          </div>
        ) : null}
      </div>
    </section>
  )
}

function OptionGroup<T extends string | number>({
  label,
  value,
  options,
  getLabel,
  onChange,
}: {
  label: string
  value: T
  options: readonly T[]
  getLabel?: (value: T) => string
  onChange: (value: T) => void
}) {
  return (
    <div>
      <p className="mb-2 font-mono text-[10px] font-bold tracking-[0.18em] text-muted-foreground uppercase">
        {label}
      </p>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            className={`rounded-[3px] border px-3 py-2 font-mono text-xs font-bold tracking-[0.06em] uppercase transition-all ${
              value === option
                ? "border-acid/70 bg-acid/15 text-acid shadow-[0_0_18px_rgba(183,243,91,0.12)]"
                : "border-border bg-background/45 text-muted-foreground hover:border-cyan/60 hover:text-cyan"
            }`}
          >
            {getLabel ? getLabel(option) : option}
          </button>
        ))}
      </div>
    </div>
  )
}

function DurationSlider({
  value,
  onChange,
}: {
  value: number
  onChange: (value: number) => void
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="font-mono text-[10px] font-bold tracking-[0.18em] text-muted-foreground uppercase">
          Duration
        </p>
        <span className="font-mono text-xs font-bold tracking-[0.08em] text-acid uppercase">
          {formatCreateDuration(value)}
        </span>
      </div>
      <Slider
        min={CREATE_DURATION_MIN_MS}
        max={CREATE_DURATION_MAX_MS}
        step={CREATE_DURATION_STEP_MS}
        value={[value]}
        onValueChange={(nextValue) => {
          const nextDuration = Array.isArray(nextValue)
            ? nextValue[0]
            : nextValue

          if (typeof nextDuration === "number") {
            onChange(nextDuration)
          }
        }}
        className="py-2"
      />
      <div className="mt-2 flex items-center justify-between font-mono text-[10px] font-bold tracking-[0.12em] text-muted-foreground uppercase">
        <span>{formatCreateDuration(CREATE_DURATION_MIN_MS)}</span>
        <span>{formatCreateDuration(CREATE_DURATION_MAX_MS)}</span>
      </div>
    </div>
  )
}

async function enhancePromptWithBackend(prompt: string) {
  const response = await fetch(ENHANCE_PROMPT_URL, {
    method: "POST",
    headers: buildGenerationHeaders({
      "Content-Type": "application/json",
    }),
    body: JSON.stringify({
      prompt,
    }),
  })

  if (!response.ok) {
    throw new Error("Prompt enhancement request failed")
  }

  const payload = (await response.json()) as Record<string, unknown>
  const enhancedPrompt = extractEnhancedPrompt(payload)

  if (!enhancedPrompt) {
    throw new Error("Prompt enhancement response was empty")
  }

  return enhancedPrompt
}

function extractEnhancedPrompt(payload: Record<string, unknown>) {
  const candidates = [
    payload.prompt,
    payload.enhancedPrompt,
    payload.enhanced_prompt,
    payload.result,
    payload.message,
  ]

  const firstCandidate = candidates.find(
    (candidate): candidate is string =>
      typeof candidate === "string" && candidate.trim().length > 0
  )

  return firstCandidate?.trim() ?? ""
}

function buildEnhancedPrompt(prompt: string, options: CreateOptions) {
  const normalizedPrompt = prompt.trim()

  if (normalizedPrompt.length === 0) {
    return buildStructuredPrompt(STARTER_PROMPT, options)
  }

  return buildStructuredPrompt(normalizedPrompt, options)
}

function buildStructuredPrompt(prompt: string, options: CreateOptions) {
  const energy = inferEnergy(prompt)
  const mood = inferMood(prompt)

  return [
    "Create an original song from this brief:",
    "",
    `Situation and feeling: ${prompt}`,
    "",
    `Target mood: ${mood}.`,
    `Energy and pace: ${energy}.`,
    `Vocal direction: ${options.vocalDirection}.`,
    `Song type: ${options.songType}.`,
    `Language: ${options.language}.`,
    `Duration: ${formatCreateDuration(options.durationMs)}.`,
    `Structure: ${options.structure}.`,
    `Instrumentation: ${options.instrumentation}.`,
    `Vocal delivery: ${options.delivery}.`,
    "Production notes: Build a strong opening, a memorable hook, and instrumentation that clearly supports the scene.",
    "Songwriting notes: Keep the emotional arc consistent and make the chorus feel earned.",
  ].join("\n")
}

function inferMood(prompt: string) {
  const normalized = prompt.toLowerCase()

  if (/(sad|heartbreak|lonely|grief|cry|rainy)/.test(normalized)) {
    return "melancholic, intimate, and emotionally honest"
  }

  if (/(happy|joy|celebrate|party|summer|fun)/.test(normalized)) {
    return "bright, playful, and uplifting"
  }

  if (/(focus|study|work|calm|peaceful|sleep)/.test(normalized)) {
    return "calm, steady, and immersive"
  }

  if (/(fight|gym|run|power|hype|adrenaline)/.test(normalized)) {
    return "intense, confident, and high-impact"
  }

  return "specific to the scene, emotionally clear, and cinematic"
}

function inferEnergy(prompt: string) {
  const normalized = prompt.toLowerCase()

  if (/(ambient|calm|soft|slow|sleep|dreamy)/.test(normalized)) {
    return "slow to mid-tempo with spacious arrangement"
  }

  if (/(dance|club|party|hyper|fast|run|workout)/.test(normalized)) {
    return "fast, punchy, and rhythm-forward"
  }

  if (/(cinematic|anthem|epic|build|dramatic)/.test(normalized)) {
    return "gradually building with a large emotional payoff"
  }

  return "mid-tempo with enough movement to stay engaging"
}
