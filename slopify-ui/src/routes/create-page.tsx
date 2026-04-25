import { useState, type FormEvent } from "react"
import { useNavigate } from "@tanstack/react-router"
import { Sparkles } from "lucide-react"
import { API_ENDPOINTS } from "@/lib/constants"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

const STARTER_PROMPT = `I'm coming down after a packed work week and driving alone through the city at night.
I want something reflective but still uplifting, with warm synths, a steady beat, and a chorus that feels hopeful.`
const BACKEND_BASE_URL = import.meta.env.VITE_BACKEND_BASE_URL?.trim() ?? ""
const ENHANCE_PROMPT_URL = buildApiUrl(
  BACKEND_BASE_URL,
  API_ENDPOINTS.enhancePrompt
)

export function CreatePage() {
  const [prompt, setPrompt] = useState("")
  const [feedback, setFeedback] = useState<string | null>(null)
  const [isEnhancing, setIsEnhancing] = useState(false)
  const navigate = useNavigate()

  const handleEnhance = async () => {
    setIsEnhancing(true)

    try {
      const nextPrompt = ENHANCE_PROMPT_URL
        ? await enhancePromptWithBackend(prompt)
        : buildEnhancedPrompt(prompt)

      setPrompt(nextPrompt)
      setFeedback(
        prompt.trim().length === 0
          ? "Added a richer starter prompt you can refine."
          : ENHANCE_PROMPT_URL
            ? "Prompt enhanced with the backend service."
            : "Expanded your idea into a more detailed music brief."
      )
    } catch {
      const nextPrompt = buildEnhancedPrompt(prompt)

      setPrompt(nextPrompt)
      setFeedback(
        "Backend enhancement was unavailable, so a local fallback prompt was used."
      )
    } finally {
      setIsEnhancing(false)
    }
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    setFeedback(
      prompt.trim().length === 0
        ? "Write a prompt first. Submit is still a placeholder for now."
        : "Submit is a dummy action for now. The prompt is ready, but generation is not wired yet."
    )
  }

  return (
    <section className="flex min-h-[calc(100svh-9rem)] items-center justify-center overflow-hidden">
      <div className="relative flex w-full max-w-5xl flex-col items-center justify-center px-4 py-8">
        <div className="absolute top-4 right-4 sm:top-6 sm:right-6">
          <Button
            type="button"
            variant="ghost"
            className="h-10 rounded-[3px] px-5"
            onClick={() => navigate({ to: "/app" })}
          >
            Library
          </Button>
        </div>

        <div className="mb-8 text-center">
          <p className="terminal-label">generation node / prompt uplink</p>
          <p className="mt-2 text-5xl font-black tracking-[-0.04em] text-foreground drop-shadow-[0_0_18px_rgba(183,214,106,0.16)] sm:text-7xl">
            Slopify
          </p>
          <p className="mt-3 text-sm font-semibold tracking-[0.24em] text-muted-foreground uppercase">
            Submit an audio signal brief
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex w-full max-w-4xl flex-col items-center gap-5"
        >
          <div className="hud-panel w-full overflow-hidden rounded-[6px] p-3">
            <div className="flex items-center justify-between border-b border-border px-3 pb-3">
              <span className="terminal-label">audio request input</span>
              <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-cyan">
                signal draft
              </span>
            </div>
            <Textarea
              value={prompt}
              onChange={(event) => {
                setPrompt(event.target.value)
                setFeedback(null)
              }}
              placeholder="Describe the scene, emotional signal, tempo, sound palette, and the kind of AI track you want."
              className="max-h-[300px] min-h-[190px] resize-none overflow-y-auto rounded-[3px] border-0 bg-background/35 px-5 py-5 text-lg leading-8 shadow-[inset_0_1px_0_rgba(238,244,237,0.04),inset_0_0_28px_rgba(0,0,0,0.24)] focus-visible:ring-0 sm:min-h-[220px] sm:text-xl"
            />

            <div className="flex flex-col gap-3 border-t border-border px-3 pt-3 sm:flex-row sm:items-center sm:justify-end">
              <Button
                type="button"
                variant="ghost"
                size="lg"
                className="h-11 rounded-[3px] px-5"
                onClick={() => void handleEnhance()}
                disabled={isEnhancing}
              >
                <Sparkles className="size-4" />
                {isEnhancing ? "Tuning Signal..." : "Enhance With AI"}
              </Button>
              <Button
                type="submit"
                size="lg"
                className="h-11 rounded-[3px] px-7"
              >
                Submit Signal
              </Button>
            </div>
          </div>

          {feedback ? (
            <div className="rounded-[3px] border border-border bg-background/70 px-4 py-2 text-center font-mono text-xs font-bold uppercase tracking-[0.08em] text-muted-foreground shadow-[inset_0_1px_0_rgba(238,244,237,0.04)]">
              {feedback}
            </div>
          ) : null}
        </form>
      </div>
    </section>
  )
}

function buildEnhancedPrompt(prompt: string) {
  const normalizedPrompt = prompt.trim()

  if (normalizedPrompt.length === 0) {
    return buildStructuredPrompt(STARTER_PROMPT)
  }

  return buildStructuredPrompt(normalizedPrompt)
}

function buildApiUrl(baseUrl: string, endpoint: string) {
  if (!baseUrl) {
    return ""
  }

  return `${baseUrl.replace(/\/+$/, "")}/${endpoint.replace(/^\/+/, "")}`
}

async function enhancePromptWithBackend(prompt: string) {
  const response = await fetch(ENHANCE_PROMPT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
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

  const firstString = candidates.find(
    (candidate): candidate is string =>
      typeof candidate === "string" && candidate.trim().length > 0
  )

  return firstString?.trim() ?? ""
}

function buildStructuredPrompt(prompt: string) {
  const energy = inferEnergy(prompt)
  const mood = inferMood(prompt)

  return [
    "Create an original song from this brief:",
    "",
    `Situation and feeling: ${prompt}`,
    "",
    `Target mood: ${mood}.`,
    `Energy and pace: ${energy}.`,
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
