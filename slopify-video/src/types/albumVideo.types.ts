import type { z } from "zod";

import type { generateAlbumVideoSchema } from "../schemas/albumVideo.schema.js";

export type GenerateAlbumVideoRequest = z.infer<typeof generateAlbumVideoSchema>;

export type AlbumVideoStatus = "queued" | "processing" | "completed" | "failed";

export type AlbumVideoPromptPayload = {
  concept: string;
  visualSymbols: string[];
  colorPalette: string;
  motionPlan: string;
  albumVideoPrompt: string;
};

export type AlbumVideoJob = {
  jobId: string;
  songId: string;
  status: AlbumVideoStatus;
  albumVideoPrompt: string;
  videoUrl: string | null;
  error: string | null;
  providerJobId?: string;
  providerResponse?: unknown;
  createdAt: string;
  updatedAt: string;
};

export type VideoGenerationOptions = {
  songId: string;
  durationSeconds: number;
  aspectRatio: GenerateAlbumVideoRequest["aspectRatio"];
  resolution: GenerateAlbumVideoRequest["resolution"];
};

export type VideoGenerationResult = {
  jobId: string;
  status: AlbumVideoStatus;
  videoUrl: string | null;
  error: string | null;
};
