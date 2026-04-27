import crypto from "node:crypto";

import { z } from "zod";

import type {
  AlbumVideoPromptPayload,
  GenerateAlbumVideoRequest
} from "../types/albumVideo.types.js";
import { env } from "../utils/env.js";
import { AppError } from "../utils/errors.js";
import { openai } from "../utils/openaiClient.js";

const SYSTEM_PROMPT = `You are an expert AI music visual director and video prompt engineer.

Your task is to convert song lyrics into a UNIQUE, NON-STATIC album video prompt.

The video must:
- NOT be static
- NOT reuse visuals
- NOT look like a slideshow
- Continuously evolve visually over time

Rules:
- Use lyrics, title, genre, mood
- Extract 3-5 key visual symbols
- Create smooth visual progression
- Make it loopable for music player
- Include camera movement, lighting, color palette
- Avoid fast cuts
- Avoid text overlays, subtitles, logos
- Avoid copyrighted characters or celebrity likeness
- No audio instructions

Return ONLY JSON:

{
  "concept": "...",
  "visualSymbols": ["...", "..."],
  "motionPlan": "...",
  "colorPalette": "...",
  "albumVideoPrompt": "final detailed prompt for video model"
}`;

const responseSchema: z.ZodType<AlbumVideoPromptPayload> = z.object({
  concept: z.string().min(1),
  visualSymbols: z.array(z.string().min(1)).min(3).max(5),
  motionPlan: z.string().min(1),
  colorPalette: z.string().min(1),
  albumVideoPrompt: z.string().min(1)
});

const stripCodeFences = (value: string): string =>
  value.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/, "");

const parsePromptPayload = (rawContent: string): AlbumVideoPromptPayload => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripCodeFences(rawContent.trim()));
  } catch {
    throw new AppError(
      "GPT returned invalid JSON",
      502,
      "PROMPT_PARSE_FAILED",
      { rawContent }
    );
  }

  const result = responseSchema.safeParse(parsed);
  if (!result.success) {
    throw new AppError(
      "GPT prompt JSON did not match required schema",
      502,
      "PROMPT_SCHEMA_INVALID",
      result.error.flatten()
    );
  }

  return result.data;
};

export const generateAlbumVideoPrompt = async (
  input: GenerateAlbumVideoRequest
): Promise<AlbumVideoPromptPayload> => {
  const generationNonce = `${input.songId}-${Date.now()}-${crypto.randomUUID()}`;
  const userPrompt = [
    "Return valid JSON only.",
    `songId: ${input.songId}`,
    `title: ${input.title}`,
    input.artistName ? `artistName: ${input.artistName}` : undefined,
    input.genre ? `genre: ${input.genre}` : undefined,
    input.mood ? `mood: ${input.mood}` : undefined,
    input.theme ? `theme: ${input.theme}` : undefined,
    `durationSeconds: ${input.durationSeconds}`,
    `aspectRatio: ${input.aspectRatio}`,
    `resolution: ${input.resolution}`,
    `generationNonce: ${generationNonce}`,
    "lyrics:",
    input.lyrics
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const response = await openai.chat.completions.create({
      model: env.CHAT_MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.8,
      response_format: { type: "json_object" }
    });

    const content = response.choices[0]?.message?.content?.trim();
    if (!content) {
      throw new AppError("GPT returned empty content", 502, "PROMPT_EMPTY");
    }

    return parsePromptPayload(content);
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError(
      "Failed to generate album video prompt with GPT-4.1",
      502,
      "PROMPT_GENERATION_FAILED"
    );
  }
};
