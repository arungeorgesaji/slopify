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
    <section className="flex h-full items-center justify-center overflow-hidden">
      <div className="relative flex h-full w-full max-w-5xl flex-col items-center justify-center px-4">
        <div className="absolute top-4 right-4 sm:top-6 sm:right-6">
          <Button
            type="button"
            variant="ghost"
            className="h-10 rounded-full px-5 text-foreground hover:bg-muted"
            onClick={() => navigate({ to: "/" })}
          >
            Library
          </Button>
        </div>

        <div className="mb-10 text-center">
          <p className="text-5xl font-semibold tracking-tight text-primary sm:text-7xl">
            Slopify
          </p>
          <p className="mt-2 text-sm font-semibold tracking-[0.28em] text-muted-foreground uppercase">
            Create
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex w-full max-w-4xl flex-col items-center gap-5"
        >
          <div className="w-full rounded-[2rem] border border-border/70 bg-background p-3 shadow-sm shadow-primary/5">
            <Textarea
              value={prompt}
              onChange={(event) => {
                setPrompt(event.target.value)
                setFeedback(null)
              }}
              placeholder="Describe your situation, your mood, and the kind of music you want."
              className="max-h-[280px] min-h-[180px] resize-none overflow-y-auto rounded-[1.5rem] border-0 bg-transparent px-5 py-5 text-lg leading-8 shadow-none focus-visible:ring-0 sm:min-h-[200px] sm:text-xl"
            />

            <div className="flex flex-col gap-3 border-t border-border/70 px-3 pt-3 sm:flex-row sm:items-center sm:justify-end">
              <Button
                type="button"
                variant="ghost"
                size="lg"
                className="h-11 rounded-full px-5 text-primary hover:bg-primary/5"
                onClick={() => void handleEnhance()}
                disabled={isEnhancing}
              >
                <Sparkles className="size-4" />
                {isEnhancing ? "Enhancing..." : "Enhance with AI"}
              </Button>
              <Button
                type="submit"
                size="lg"
                className="h-11 rounded-full px-7"
              >
                Submit
              </Button>
            </div>
          </div>

          {feedback ? (
            <div className="rounded-full border border-border/70 bg-background px-4 py-2 text-center text-sm text-muted-foreground shadow-sm">
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
