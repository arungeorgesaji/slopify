import type { AlbumVideoJob } from "../types/albumVideo.types.js";
import { AppError } from "../utils/errors.js";

const jobs = new Map<string, AlbumVideoJob>();
// TODO: Replace this in-memory store with Redis/Postgres for multi-instance durability.

const nowIso = (): string => new Date().toISOString();

export const createJob = (job: AlbumVideoJob): AlbumVideoJob => {
  jobs.set(job.jobId, job);
  return job;
};

export const getJob = (jobId: string): AlbumVideoJob => {
  const job = jobs.get(jobId);
  if (!job) {
    throw new AppError("Job not found", 404, "JOB_NOT_FOUND");
  }
  return job;
};

export const updateJob = (
  jobId: string,
  updates: Partial<Omit<AlbumVideoJob, "jobId" | "songId" | "createdAt">>
): AlbumVideoJob => {
  const existing = getJob(jobId);
  const updated: AlbumVideoJob = {
    ...existing,
    ...updates,
    updatedAt: nowIso()
  };
  jobs.set(jobId, updated);
  return updated;
};
