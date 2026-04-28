import crypto from "node:crypto";

import { createJob, getJob, updateJob } from "../stores/job.store.js";
import type {
  AlbumVideoJob,
  AlbumVideoStatus,
  VideoGenerationOptions,
  VideoGenerationResult
} from "../types/albumVideo.types.js";
import { env } from "../utils/env.js";
import { AppError } from "../utils/errors.js";
import { uploadVideoBytesToStorage } from "./videoStorage.service.js";

type SoraStatus = "queued" | "in_progress" | "completed" | "failed";

type SoraVideo = {
  id: string;
  status: SoraStatus;
  error?: { code?: string; message?: string } | null;
  progress?: number;
  model?: string;
  seconds?: string;
  size?: string;
  [key: string]: unknown;
};

const silentVideoCache = new Map<string, { bytes: Uint8Array; contentType: string }>();

const nowIso = (): string => new Date().toISOString();

export const createQueuedVideoJob = (params: {
  songId: string;
  albumVideoPrompt?: string;
}): Promise<AlbumVideoJob> => {
  const createdAt = nowIso();
  const job: AlbumVideoJob = {
    jobId: crypto.randomUUID(),
    songId: params.songId,
    status: "queued",
    albumVideoPrompt: params.albumVideoPrompt ?? "",
    videoUrl: null,
    error: null,
    createdAt,
    updatedAt: createdAt
  };
  return createJob(job);
};

const toAlbumVideoStatus = (status: SoraStatus): AlbumVideoStatus => {
  if (status === "completed") {
    return "completed";
  }
  if (status === "failed") {
    return "failed";
  }
  if (status === "in_progress") {
    return "processing";
  }
  return "queued";
};

const secondsForSora = (seconds: number): "4" | "8" | "12" => {
  if (seconds <= 4) {
    return "4";
  }
  if (seconds <= 8) {
    return "8";
  }
  return "12";
};

const sizeForSora = (
  aspectRatio: VideoGenerationOptions["aspectRatio"],
  resolution: VideoGenerationOptions["resolution"]
): "720x1280" | "1280x720" | "1024x1792" | "1792x1024" => {
  if (aspectRatio === "9:16") {
    return resolution === "1080p" ? "1024x1792" : "720x1280";
  }

  if (aspectRatio === "1:1") {
    return "1280x720";
  }

  return resolution === "1080p" ? "1792x1024" : "1280x720";
};

const readJson = async (response: Response): Promise<unknown> => {
  const text = await response.text();
  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { error: { message: text.slice(0, 500) } };
  }
};

const responseErrorMessage = async (response: Response): Promise<string> => {
  const json = await readJson(response);
  const message =
    typeof json === "object" &&
    json !== null &&
    "error" in json &&
    typeof (json as { error?: { message?: unknown } }).error?.message === "string"
      ? (json as { error: { message: string } }).error.message
      : null;

  const base = `Sora request failed with ${response.status} ${response.statusText}`.trim();
  return message ? `${base}: ${message}` : base;
};

const createSoraVideo = async (
  albumVideoPrompt: string,
  options: VideoGenerationOptions,
  jobId: string,
  openAIApiKey: string
): Promise<SoraVideo> => {
  console.info(`[sora] video request sent for job ${jobId}`);
  try {
    const response = await fetch("https://api.openai.com/v1/videos", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openAIApiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: env.VIDEO_MODEL,
        prompt: `${albumVideoPrompt}\n\nUnique seed: ${jobId}. Silent video only. No audio track. No music. No sound effects. No subtitles. No visible lyrics. No logos.`,
        seconds: secondsForSora(options.durationSeconds),
        size: sizeForSora(options.aspectRatio, options.resolution)
      })
    });

    if (!response.ok) {
      throw new AppError(await responseErrorMessage(response), 502, "SORA_CREATE_FAILED");
    }

    console.info(`[sora] video response received for job ${jobId}`);
    return (await readJson(response)) as SoraVideo;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    throw new AppError(
      error instanceof Error ? error.message : "Sora request failed",
      502,
      "SORA_CREATE_FAILED"
    );
  }
};

const retrieveSoraVideo = async (
  providerJobId: string,
  openAIApiKey: string
): Promise<SoraVideo> => {
  const response = await fetch(`https://api.openai.com/v1/videos/${providerJobId}`, {
    headers: {
      Authorization: `Bearer ${openAIApiKey}`
    }
  });

  if (!response.ok) {
    throw new AppError(await responseErrorMessage(response), 502, "SORA_RETRIEVE_FAILED");
  }

  return (await readJson(response)) as SoraVideo;
};

const downloadSoraVideo = async (
  providerJobId: string,
  openAIApiKey: string
): Promise<{
  bytes: Uint8Array;
  contentType: string;
}> => {
  const response = await fetch(`https://api.openai.com/v1/videos/${providerJobId}/content`, {
    headers: {
      Authorization: `Bearer ${openAIApiKey}`
    }
  });

  if (!response.ok) {
    throw new AppError(await responseErrorMessage(response), 502, "SORA_DOWNLOAD_FAILED");
  }

  return {
    bytes: new Uint8Array(await response.arrayBuffer()),
    contentType: response.headers.get("content-type") ?? "video/mp4"
  };
};

const failJob = async (jobId: string, error: unknown): Promise<AlbumVideoJob> => {
  const message = error instanceof Error ? error.message : "Video generation failed";
  console.error(`[sora] video failed for job ${jobId}`, error);
  return updateJob(jobId, {
    status: "failed",
    error: message
  });
};

const completeSoraJob = async (
  job: AlbumVideoJob,
  providerResponse: SoraVideo,
  openAIApiKey: string
): Promise<AlbumVideoJob> => {
  const downloaded = await downloadSoraVideo(providerResponse.id, openAIApiKey);
  silentVideoCache.set(providerResponse.id, {
    bytes: downloaded.bytes,
    contentType: downloaded.contentType
  });

  const fallbackVideoUrl = `/album-video/video/${providerResponse.id}`;
  let videoUrl = fallbackVideoUrl;
  let storage: "supabase" | "sora-proxy" | "supabase-failed" = "sora-proxy";
  let storageError: string | undefined;

  try {
    const storedVideoUrl = await uploadVideoBytesToStorage({
      bytes: downloaded.bytes,
      contentType: downloaded.contentType,
      songId: job.songId,
      jobId: job.jobId
    });

    if (storedVideoUrl) {
      videoUrl = storedVideoUrl;
      storage = "supabase";
    }
  } catch (error) {
    storage = "supabase-failed";
    storageError = error instanceof Error ? error.message : "Supabase upload failed";
    console.error(`[sora] Supabase upload failed for job ${job.jobId}`, error);
  }

  const completed = await updateJob(job.jobId, {
    status: "completed",
    videoUrl,
    error: null,
    providerResponse: {
      ...providerResponse,
      storage,
      storageError,
      audio: "requested-silent"
    }
  });

  console.info(`[sora] video completed for job ${job.jobId}`);
  return completed;
};

export const generateVideo = async (
  albumVideoPrompt: string,
  options: VideoGenerationOptions,
  openAIApiKey: string
): Promise<VideoGenerationResult> => {
  const job = await createQueuedVideoJob({
    songId: options.songId,
    albumVideoPrompt
  });
  const { jobId } = job;

  try {
    await updateJob(jobId, { status: "processing", error: null });
    const providerResponse = await createSoraVideo(
      albumVideoPrompt,
      options,
      jobId,
      openAIApiKey
    );
    const status = toAlbumVideoStatus(providerResponse.status);

    const updated = await updateJob(jobId, {
      status,
      error: providerResponse.error?.message ?? null,
      providerJobId: providerResponse.id,
      providerResponse
    });

    if (status === "completed") {
      const completed = await completeSoraJob(updated, providerResponse, openAIApiKey);
      return {
        jobId,
        status: completed.status,
        videoUrl: completed.videoUrl,
        error: completed.error
      };
    }

    return {
      jobId,
      status,
      videoUrl: null,
      error: updated.error
    };
  } catch (error) {
    const failed = await failJob(jobId, error);
    return {
      jobId,
      status: failed.status,
      videoUrl: failed.videoUrl,
      error: failed.error
    };
  }
};

export const generateVideoForJob = async (
  jobId: string,
  albumVideoPrompt: string,
  options: VideoGenerationOptions,
  openAIApiKey: string
): Promise<VideoGenerationResult> => {
  try {
    await updateJob(jobId, {
      status: "processing",
      albumVideoPrompt,
      error: null
    });
    const providerResponse = await createSoraVideo(
      albumVideoPrompt,
      options,
      jobId,
      openAIApiKey
    );
    const status = toAlbumVideoStatus(providerResponse.status);

    const updated = await updateJob(jobId, {
      status,
      error: providerResponse.error?.message ?? null,
      providerJobId: providerResponse.id,
      providerResponse
    });

    if (status === "completed") {
      const completed = await completeSoraJob(updated, providerResponse, openAIApiKey);
      return {
        jobId,
        status: completed.status,
        videoUrl: completed.videoUrl,
        error: completed.error
      };
    }

    return {
      jobId,
      status,
      videoUrl: null,
      error: updated.error
    };
  } catch (error) {
    const failed = await failJob(jobId, error);
    return {
      jobId,
      status: failed.status,
      videoUrl: failed.videoUrl,
      error: failed.error
    };
  }
};

export const getVideoStatus = async (
  jobId: string,
  openAIApiKey: string | null
): Promise<AlbumVideoJob> => {
  const job = await getJob(jobId);
  if (job.status === "completed" || job.status === "failed" || !job.providerJobId) {
    return job;
  }

  if (!openAIApiKey) {
    throw new AppError(
      "OpenAI API key is required to refresh an in-progress video job.",
      400,
      "OPENAI_API_KEY_REQUIRED"
    );
  }

  try {
    const providerResponse = await retrieveSoraVideo(job.providerJobId, openAIApiKey);
    const status = toAlbumVideoStatus(providerResponse.status);

    if (status === "completed") {
      return completeSoraJob(job, providerResponse, openAIApiKey);
    }

    if (status === "failed") {
      return failJob(jobId, providerResponse.error?.message ?? "Sora video generation failed");
    }

    return updateJob(jobId, {
      status,
      error: null,
      providerResponse
    });
  } catch (error) {
    return failJob(jobId, error);
  }
};

export const downloadVideoContent = async (
  providerJobId: string,
  openAIApiKey: string | null
): Promise<{
  bytes: Uint8Array;
  contentType: string;
}> => {
  const cached = silentVideoCache.get(providerJobId);
  if (cached) {
    return cached;
  }

  if (!openAIApiKey) {
    throw new AppError(
      "OpenAI API key is required to proxy uncached video content.",
      400,
      "OPENAI_API_KEY_REQUIRED"
    );
  }

  const downloaded = await downloadSoraVideo(providerJobId, openAIApiKey);
  silentVideoCache.set(providerJobId, downloaded);
  return downloaded;
};
