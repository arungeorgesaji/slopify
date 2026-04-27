import type { GenerateAlbumVideoRequest } from "../types/albumVideo.types.js";
import { generateAlbumVideoPrompt } from "./gptPrompt.service.js";
import {
  createQueuedVideoJob,
  generateVideoForJob
} from "./soraVideo.service.js";

export const startAlbumVideoGeneration = (input: GenerateAlbumVideoRequest): void => {
  const job = createQueuedVideoJob({
    songId: input.songId
  });

  void (async () => {
    try {
      console.info(`[job] prompt generation started for song ${input.songId}`);
      const prompt = await generateAlbumVideoPrompt(input);
      console.info(`[job] prompt generated for song ${input.songId}`);

      await generateVideoForJob(job.jobId, prompt.albumVideoPrompt, {
        songId: input.songId,
        durationSeconds: input.durationSeconds,
        aspectRatio: input.aspectRatio,
        resolution: input.resolution
      });
    } catch (error) {
      console.error(`[job] generation failed for song ${input.songId}`, error);
    }
  })();
};
