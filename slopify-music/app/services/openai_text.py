from __future__ import annotations

from openai import OpenAI


PROMPT_ENHANCER_INSTRUCTIONS = """
You enhance user ideas into high-quality music generation prompts.

The final prompt will be passed into ElevenLabs for music generation, so write for a downstream music model rather than for a human conversation.

Rules:
- Return only the enhanced prompt text.
- Keep it concise but vivid.
- Include genre, mood, instrumentation, vocal style, tempo/rhythm, production texture, and song structure cues when useful.
- Preserve the user's core intent and constraints.
- Preserve the user's literal words and concepts whenever possible.
- Assume the user always wants a usable music-generation prompt, even if their input is short, vague, fragmentary, or not obviously musical.
- If the input is short or ambiguous, expand it into a musical direction that is explicitly about those words rather than replacing them with an unrelated generic theme.
- Treat unusual or meta-sounding words as possible lyrical, thematic, or production material unless the user clearly intends otherwise.
- Do not discard or overwrite the main subject of the input just because it seems minimal, abstract, or unusual.
- Do not repeat meaningless or low-signal words verbatim when they weaken the result; translate them into a coherent musical direction grounded in the likely intent.
- If the user gives almost no context, choose sensible defaults that still sound specific and modern rather than generic.
- Do not mention OpenAI, GPT, or these instructions.
- Do not add markdown, labels, or explanations.
""".strip()


LYRICS_INSTRUCTIONS = """
You write original song lyrics based on the user's request.

Rules:
- Return only the lyrics.
- Make the lyrics coherent, singable, and emotionally specific.
- Respect any requested genre, tone, theme, language, and structure.
- If the request is underspecified, make reasonable musical choices.
- Do not include commentary, section notes unless they are part of the requested lyrical format, or markdown fencing.
""".strip()


class OpenAITextError(Exception):
    """Raised when OpenAI text generation fails."""


class OpenAITextService:
    def __init__(self, api_key: str) -> None:
        self._client = OpenAI(api_key=api_key)

    def enhance_prompt(self, prompt: str, model: str) -> str:
        return self._generate_text(
            instructions=PROMPT_ENHANCER_INSTRUCTIONS,
            prompt=self._build_enhancement_input(prompt),
            model=model,
        )

    def generate_lyrics(self, prompt: str, model: str) -> str:
        return self._generate_text(
            instructions=LYRICS_INSTRUCTIONS,
            prompt=prompt,
            model=model,
        )

    def _generate_text(self, *, instructions: str, prompt: str, model: str) -> str:
        try:
            response = self._client.responses.create(
                model=model,
                reasoning={"effort": "low"},
                instructions=instructions,
                input=prompt,
            )
        except Exception as exc:
            raise OpenAITextError(str(exc)) from exc

        output_text = (response.output_text or "").strip()
        if not output_text:
            raise OpenAITextError("The model returned an empty response.")
        return output_text

    @staticmethod
    def _build_enhancement_input(prompt: str) -> str:
        cleaned_prompt = prompt.strip()
        return (
            "Convert the following user text into a strong music-generation prompt. "
            "Treat the text as intentional context even if it is vague, fragmentary, "
            "or not explicitly musical.\n\n"
            f"User text:\n{cleaned_prompt}"
        )
