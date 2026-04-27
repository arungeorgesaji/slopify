import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { env } from "../utils/env.js";
import { AppError } from "../utils/errors.js";

const hasSupabaseConfig = Boolean(
  env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY && env.SUPABASE_STORAGE_BUCKET
);
const supabase: SupabaseClient | null = hasSupabaseConfig
  ? createClient(env.SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false }
    })
  : null;

const stripFragment = (url: string): string => {
  const hashIndex = url.indexOf("#");
  return hashIndex >= 0 ? url.slice(0, hashIndex) : url;
};

const extensionForContentType = (contentType: string): "mp4" | "webm" =>
  contentType.includes("webm") ? "webm" : "mp4";

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const fetchWithRetry = async (
  url: string,
  init: RequestInit,
  attempts = 3
): Promise<Response> => {
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fetch(url, init);
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        await sleep(700 * attempt);
      }
    }
  }

  throw lastError;
};

const storageObjectUrl = (path: string): string => {
  const baseUrl = env.SUPABASE_URL!.replace(/\/$/, "");
  const bucket = encodeURIComponent(env.SUPABASE_STORAGE_BUCKET!);
  const encodedPath = path.split("/").map(encodeURIComponent).join("/");
  return `${baseUrl}/storage/v1/object/${bucket}/${encodedPath}`;
};

const signedUrlExpiresInSeconds = 60 * 60 * 24 * 365;

const createSignedVideoUrl = async (path: string): Promise<string | null> => {
  if (!supabase || !env.SUPABASE_STORAGE_BUCKET) {
    return null;
  }

  const { data, error } = await supabase.storage
    .from(env.SUPABASE_STORAGE_BUCKET)
    .createSignedUrl(path, signedUrlExpiresInSeconds);

  if (error || !data?.signedUrl) {
    return null;
  }

  return data.signedUrl;
};

export const uploadVideoBytesToStorage = async (params: {
  bytes: Uint8Array;
  contentType: string;
  songId: string;
  jobId: string;
}): Promise<string | null> => {
  if (
    !hasSupabaseConfig ||
    !env.SUPABASE_URL ||
    !env.SUPABASE_SERVICE_ROLE_KEY ||
    !env.SUPABASE_STORAGE_BUCKET
  ) {
    return null;
  }

  const path = `album-videos/${params.songId}/${params.jobId}-${Date.now()}.${extensionForContentType(params.contentType)}`;

  const copiedBytes = new ArrayBuffer(params.bytes.byteLength);
  new Uint8Array(copiedBytes).set(params.bytes);

  let response: Response;
  try {
    response = await fetchWithRetry(storageObjectUrl(path), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        "Content-Type": params.contentType,
        "x-upsert": "false"
      },
      body: new Blob([copiedBytes], { type: params.contentType })
    });
  } catch (error) {
    throw new AppError(
      "Failed to upload video to Supabase storage",
      502,
      "VIDEO_UPLOAD_FAILED",
      error instanceof Error ? error.message : error
    );
  }

  if (!response.ok) {
    const details = await response.text();
    throw new AppError(
      "Failed to upload video to Supabase storage",
      502,
      "VIDEO_UPLOAD_FAILED",
      details || `${response.status} ${response.statusText}`
    );
  }

  return createSignedVideoUrl(path);
};

export const uploadVideoFromUrlToStorage = async (params: {
  sourceUrl: string;
  songId: string;
  jobId: string;
}): Promise<string | null> => {
  if (!hasSupabaseConfig || !env.SUPABASE_STORAGE_BUCKET) {
    return null;
  }

  const response = await fetch(stripFragment(params.sourceUrl));
  if (!response.ok) {
    throw new AppError(
      `Failed to download generated video (${response.status})`,
      502,
      "VIDEO_DOWNLOAD_FAILED"
    );
  }

  const contentType = response.headers.get("content-type") ?? "video/mp4";
  const bytes = new Uint8Array(await response.arrayBuffer());
  return uploadVideoBytesToStorage({
    bytes,
    contentType,
    songId: params.songId,
    jobId: params.jobId
  });
};
