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

TITLE_INSTRUCTIONS = """
You create a concise original song title based on lyrics.

Rules:
- Return only the title text.
- Use 2 to 6 words when possible.
- Make it memorable, specific, and singable.
- Base it on the lyrics' central hook, image, or repeated phrase.
- Do not add quotation marks, markdown, labels, or explanations.
- Do not output more than 80 characters.
""".strip()

VIDEO_THEME_INSTRUCTIONS = """
You compress song context into a short theme string for downstream video generation.

Rules:
- Return only the theme text.
- Preserve the song's core idea, mood, and imagery.
- Prefer a compact phrase rather than a sentence when possible.
- Do not add quotation marks, markdown, labels, or explanations.
- Keep the output at 120 characters or fewer.
""".strip()

IMAGE_BRIEF_SUMMARIZER_INSTRUCTIONS = """
You compress album-cover request text for downstream image generation.

Rules:
- Return only the rewritten brief text.
- Preserve the core subject, mood, style, and imagery.
- Prefer vivid noun phrases and short clauses over full sentences when possible.
- Do not add quotation marks, markdown, labels, or explanations.
- Keep the output at 200 characters or fewer.
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

    def generate_title_from_lyrics(self, lyrics: str, model: str) -> str:
        return self._generate_text(
            instructions=TITLE_INSTRUCTIONS,
            prompt=self._build_title_input(lyrics),
            model=model,
        )

    def generate_video_theme(
        self,
        *,
        title: str | None,
        prompt: str | None,
        lyrics: str | None,
        model: str,
    ) -> str:
        return self._generate_text(
            instructions=VIDEO_THEME_INSTRUCTIONS,
            prompt=self._build_video_theme_input(
                title=title,
                prompt=prompt,
                lyrics=lyrics,
            ),
            model=model,
        )

    def summarize_image_brief(self, prompt: str, model: str) -> str:
        return self._generate_text(
            instructions=IMAGE_BRIEF_SUMMARIZER_INSTRUCTIONS,
            prompt=self._build_image_brief_input(prompt),
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

    @staticmethod
    def _build_title_input(lyrics: str) -> str:
        cleaned_lyrics = lyrics.strip()
        return (
            "Write a strong song title for the following lyrics. Prefer the main hook "
            "or most emotionally central phrase.\n\n"
            f"Lyrics:\n{cleaned_lyrics}"
        )

    @staticmethod
    def _build_video_theme_input(
        *,
        title: str | None,
        prompt: str | None,
        lyrics: str | None,
    ) -> str:
        parts: list[str] = [
            "Compress the following song context into a short theme for album video generation."
        ]

        if title and title.strip():
            parts.append(f"Title:\n{title.strip()}")
        if prompt and prompt.strip():
            parts.append(f"Prompt:\n{prompt.strip()}")
        if lyrics and lyrics.strip():
            parts.append(f"Lyrics:\n{lyrics.strip()}")

        return "\n\n".join(parts)

    @staticmethod
    def _build_image_brief_input(prompt: str) -> str:
        cleaned_prompt = prompt.strip()
        return (
            "Compress the following album-cover brief for image generation while "
            "preserving the main subject, mood, and visual cues.\n\n"
            f"Brief:\n{cleaned_prompt}"
        )


def derive_title_from_lyrics(lyrics: str) -> str:
    normalized_lines = [
        line.strip()
        for line in lyrics.splitlines()
        if line.strip() and not line.strip().startswith("[")
    ]
    if not normalized_lines:
        return "Untitled Signal"

    first_line_words = _clean_title_words(normalized_lines[0].split())
    if first_line_words:
        return " ".join(first_line_words[:6])[:80].strip() or "Untitled Signal"

    all_words = _clean_title_words(" ".join(normalized_lines).split())
    if not all_words:
        return "Untitled Signal"

    return " ".join(all_words[:6])[:80].strip() or "Untitled Signal"


def _clean_title_words(words: list[str]) -> list[str]:
    cleaned_words: list[str] = []

    for word in words:
        cleaned = "".join(
            character for character in word if character.isalnum() or character in {"'", "-"}
        ).strip("-'")
        if cleaned:
            cleaned_words.append(cleaned)

    return cleaned_words
