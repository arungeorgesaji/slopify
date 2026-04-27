import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { AlbumVideoJob } from "../types/albumVideo.types.js";
import { env } from "../utils/env.js";
import { AppError } from "../utils/errors.js";

const jobs = new Map<string, AlbumVideoJob>();
const JOB_STATE_PREFIX = "_job-state";

const supabase: SupabaseClient | null =
  env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY
    ? createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false }
      })
    : null;

const canPersistJobs = Boolean(supabase && env.SUPABASE_STORAGE_BUCKET);

const nowIso = (): string => new Date().toISOString();

const jobPath = (jobId: string): string => `${JOB_STATE_PREFIX}/jobs/${jobId}.json`;
const songIndexPath = (songId: string): string =>
  `${JOB_STATE_PREFIX}/songs/${songId}.json`;

const persistJson = async (path: string, value: unknown): Promise<void> => {
  if (!canPersistJobs || !supabase || !env.SUPABASE_STORAGE_BUCKET) {
    return;
  }

  const payload = new Blob([JSON.stringify(value)], {
    type: "application/json"
  });
  const { error } = await supabase.storage
    .from(env.SUPABASE_STORAGE_BUCKET)
    .upload(path, payload, {
      upsert: true,
      contentType: "application/json"
    });

  if (error) {
    throw new AppError(
      "Failed to persist video job state",
      502,
      "JOB_PERSIST_FAILED",
      error.message
    );
  }
};

const removeObject = async (path: string): Promise<void> => {
  if (!canPersistJobs || !supabase || !env.SUPABASE_STORAGE_BUCKET) {
    return;
  }

  const { error } = await supabase.storage
    .from(env.SUPABASE_STORAGE_BUCKET)
    .remove([path]);

  if (error) {
    throw new AppError(
      "Failed to remove video job state",
      502,
      "JOB_REMOVE_FAILED",
      error.message
    );
  }
};

const readJson = async <T>(path: string): Promise<T | null> => {
  if (!canPersistJobs || !supabase || !env.SUPABASE_STORAGE_BUCKET) {
    return null;
  }

  const { data, error } = await supabase.storage
    .from(env.SUPABASE_STORAGE_BUCKET)
    .download(path);

  if (error || !data) {
    return null;
  }

  try {
    const text = await data.text();
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
};

const syncSongIndex = async (job: AlbumVideoJob): Promise<void> => {
  if (job.status === "failed") {
    await removeObject(songIndexPath(job.songId));
    return;
  }

  await persistJson(songIndexPath(job.songId), {
    jobId: job.jobId,
    songId: job.songId,
    status: job.status,
    updatedAt: job.updatedAt
  });
};

const persistJob = async (job: AlbumVideoJob): Promise<void> => {
  await persistJson(jobPath(job.jobId), job);
  await syncSongIndex(job);
};

export const createJob = async (job: AlbumVideoJob): Promise<AlbumVideoJob> => {
  jobs.set(job.jobId, job);
  await persistJob(job);
  return job;
};

export const getJob = async (jobId: string): Promise<AlbumVideoJob> => {
  const cached = jobs.get(jobId);
  if (cached) {
    return cached;
  }

  const persisted = await readJson<AlbumVideoJob>(jobPath(jobId));
  if (persisted) {
    jobs.set(jobId, persisted);
    return persisted;
  }

  throw new AppError("Job not found", 404, "JOB_NOT_FOUND");
};

export const getJobBySongId = async (
  songId: string
): Promise<AlbumVideoJob | null> => {
  const index = await readJson<{ jobId?: string }>(songIndexPath(songId));
  if (!index?.jobId) {
    return null;
  }

  try {
    return await getJob(index.jobId);
  } catch {
    return null;
  }
};

export const updateJob = async (
  jobId: string,
  updates: Partial<Omit<AlbumVideoJob, "jobId" | "songId" | "createdAt">>
): Promise<AlbumVideoJob> => {
  const existing = await getJob(jobId);
  const updated: AlbumVideoJob = {
    ...existing,
    ...updates,
    updatedAt: nowIso()
  };
  jobs.set(jobId, updated);
  await persistJob(updated);
  return updated;
};
