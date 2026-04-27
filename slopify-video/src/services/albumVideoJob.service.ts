import type { GenerateAlbumVideoRequest } from "../types/albumVideo.types.js";
import type { AlbumVideoJob } from "../types/albumVideo.types.js";
import { generateAlbumVideoPrompt } from "./gptPrompt.service.js";
import {
  createQueuedVideoJob,
  generateVideoForJob
} from "./soraVideo.service.js";
import { getJobBySongId } from "../stores/job.store.js";

export const startAlbumVideoGeneration = async (
  input: GenerateAlbumVideoRequest
): Promise<AlbumVideoJob> => {
  const existingJob = await getJobBySongId(input.songId);
  if (existingJob && existingJob.status !== "failed") {
    return existingJob;
  }

  const job = await createQueuedVideoJob({
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

  return job;
};
