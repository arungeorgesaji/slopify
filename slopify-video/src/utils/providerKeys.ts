import type { Context } from "hono";

import { env } from "./env.js";
import { AppError } from "./errors.js";

const OPENAI_API_KEY_HEADER = "x-openai-api-key";

export const resolveOpenAIApiKey = (c: Context): string | null => {
  const headerValue = c.req.header(OPENAI_API_KEY_HEADER)?.trim();
  if (headerValue) {
    return headerValue;
  }

  return env.OPENAI_API_KEY ?? null;
};

export const requireOpenAIApiKey = (c: Context): string => {
  const apiKey = resolveOpenAIApiKey(c);
  if (!apiKey) {
    throw new AppError(
      "OpenAI API key is required for album video generation.",
      400,
      "OPENAI_API_KEY_REQUIRED"
    );
  }
  return apiKey;
};
