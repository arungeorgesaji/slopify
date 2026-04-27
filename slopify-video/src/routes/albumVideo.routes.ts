import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";

import {
  generateAlbumVideoSchema,
  jobIdParamSchema
} from "../schemas/albumVideo.schema.js";
import { startAlbumVideoGeneration } from "../services/albumVideoJob.service.js";
import {
  downloadVideoContent,
  getVideoStatus
} from "../services/soraVideo.service.js";
import { validationErrorResponse } from "../utils/errors.js";

export const albumVideoRoutes = new Hono();

albumVideoRoutes.post(
  "/generate",
  zValidator("json", generateAlbumVideoSchema, (result, c) => {
    if (!result.success) {
      return c.json(validationErrorResponse(result.error), 400);
    }
  }),
  async (c) => {
    const input = c.req.valid("json");
    console.info(`[route] request received for song ${input.songId}`);

    startAlbumVideoGeneration(input);

    return c.json({ success: true }, 202);
  }
);

albumVideoRoutes.get(
  "/video/:providerJobId",
  async (c) => {
    const providerJobId = c.req.param("providerJobId");
    const video = await downloadVideoContent(providerJobId);
    return new Response(video.bytes.buffer as ArrayBuffer, {
      headers: {
        "Content-Type": video.contentType,
        "Cache-Control": "private, max-age=300"
      }
    });
  }
);

albumVideoRoutes.get(
  "/status/:jobId",
  zValidator("param", jobIdParamSchema, (result, c) => {
    if (!result.success) {
      return c.json(validationErrorResponse(result.error), 400);
    }
  }),
  async (c) => {
    const { jobId } = c.req.valid("param");
    const job = await getVideoStatus(jobId);

    return c.json({
      jobId: job.jobId,
      songId: job.songId,
      status: job.status,
      albumVideoPrompt: job.albumVideoPrompt,
      videoUrl: job.videoUrl,
      error: job.error
    });
  }
);
