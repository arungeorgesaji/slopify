import crypto from "node:crypto";

import { z } from "zod";

export const generateAlbumVideoSchema = z
  .object({
    id: z.string().uuid().optional(),
    songId: z.string().trim().min(1).max(200).optional(),
    title: z.string().trim().min(1).max(200).default("Untitled song"),
    artistName: z.string().trim().min(1).max(200).optional(),
    lyrics: z.string().trim().min(1).max(25_000).default("Instrumental mood piece"),
    genre: z.string().trim().min(1).max(100).optional(),
    mood: z.string().trim().min(1).max(100).optional(),
    theme: z.string().trim().min(1).max(120).optional(),
    durationSeconds: z.number().int().min(4).max(12).default(8),
    aspectRatio: z.enum(["16:9", "9:16", "1:1"]).default("16:9"),
    resolution: z.enum(["720p", "1080p"]).default("720p")
  })
  .transform((input) => ({
    ...input,
    songId: input.songId ?? input.id ?? crypto.randomUUID()
  }));

export const jobIdParamSchema = z.object({
  jobId: z.string().uuid()
});
