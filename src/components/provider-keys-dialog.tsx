import { useState } from "react"
import { KeyRound } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  clearProviderKeys,
  getStoredProviderKeys,
  hasRequiredGenerationKeys,
  saveProviderKeys,
  type ProviderKeys,
} from "@/lib/provider-keys"

export function ProviderKeysDialog() {
  const [open, setOpen] = useState(false)
  const [keys, setKeys] = useState<ProviderKeys>(getStoredProviderKeys)
  const [status, setStatus] = useState<string | null>(null)

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen)

    if (!nextOpen) {
      setKeys(getStoredProviderKeys())
      setStatus(null)
    }
  }

  const isConfigured = hasRequiredGenerationKeys(keys)

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            className="h-10 flex-1 rounded-[3px] px-4 text-center sm:flex-none sm:px-5"
          />
        }
      >
        <KeyRound className="size-4" />
        API Keys
      </DialogTrigger>
      <DialogContent className="max-w-lg rounded-[6px] border border-border bg-background/96 p-0 shadow-[0_24px_80px_rgba(0,0,0,0.48)]">
        <DialogHeader className="border-b border-border px-5 py-4">
          <DialogTitle>Connect Your Providers</DialogTitle>
          <DialogDescription>
            Generation uses your own OpenAI and ElevenLabs keys stored only in this browser.
            Listening to the public library does not require keys.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 px-5 py-4">
          <StatusBanner
            text={
              isConfigured
                ? "Generation is enabled on this device."
                : "Add both keys to enable lyrics, cover art, music, and video generation."
            }
            tone={isConfigured ? "ready" : "warning"}
          />

          <label className="grid gap-2 text-sm text-muted-foreground">
            <span className="terminal-label">OpenAI API key</span>
            <Input
              type="password"
              autoComplete="off"
              spellCheck={false}
              value={keys.openAIApiKey}
              onChange={(event) =>
                setKeys((current) => ({
                  ...current,
                  openAIApiKey: event.target.value,
                }))
              }
              placeholder="sk-..."
              className="h-10"
            />
          </label>

          <label className="grid gap-2 text-sm text-muted-foreground">
            <span className="terminal-label">ElevenLabs API key</span>
            <Input
              type="password"
              autoComplete="off"
              spellCheck={false}
              value={keys.elevenLabsApiKey}
              onChange={(event) =>
                setKeys((current) => ({
                  ...current,
                  elevenLabsApiKey: event.target.value,
                }))
              }
              placeholder="xi-..."
              className="h-10"
            />
          </label>

          {status ? (
            <p className="text-xs font-semibold tracking-[0.04em] text-muted-foreground">
              {status}
            </p>
          ) : null}
        </div>

        <DialogFooter className="border-border bg-background/88">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              clearProviderKeys()
              setKeys(getStoredProviderKeys())
              setStatus("Saved keys removed from this browser.")
            }}
          >
            Clear
          </Button>
          <Button
            type="button"
            onClick={() => {
              saveProviderKeys(keys)
              setStatus(
                hasRequiredGenerationKeys(keys)
                  ? "Keys saved locally. Generation is ready."
                  : "Keys saved locally. Add the missing provider key to generate songs."
              )
            }}
          >
            Save Keys
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function StatusBanner({
  text,
  tone,
}: {
  text: string
  tone: "ready" | "warning"
}) {
  return (
    <div
      className={`rounded-[4px] border px-3 py-3 text-sm ${
        tone === "ready"
          ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-100"
          : "border-amber-500/35 bg-amber-500/10 text-amber-100"
      }`}
    >
      {text}
    </div>
  )
}
