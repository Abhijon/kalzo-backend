import { randomUUID } from "crypto";
import { env } from "../config/env";
import {
  s3DeleteObject,
  s3ObjectExists,
  s3ObjectUrl,
  s3PutObject,
} from "../lib/s3";

/** Extension from mime; falls back to bin. */
function extForMime(mime: string): string {
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "video/mp4": "mp4",
    "video/webm": "webm",
    "video/quicktime": "mov",
    "video/x-matroska": "webm",
  };
  return map[mime.split(";")[0]?.trim().toLowerCase() ?? ""] ?? "bin";
}

/**
 * Normalize a stored object key and block path traversal.
 * Returns "" when the key is unsafe or empty.
 */
export function normalizeObjectKey(input: string): string {
  const cleaned = String(input || "")
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .trim();
  if (!cleaned || cleaned.includes("\0") || cleaned.split("/").some((p) => p === ".." || p === "")) {
    return "";
  }
  return cleaned;
}

/** Absolute browser URL for an S3 object key. */
export function publicUrl(key: string): string {
  const safe = normalizeObjectKey(key);
  if (!safe) return "";
  return s3ObjectUrl(safe);
}

export async function mediaExists(key: string): Promise<boolean> {
  const safe = normalizeObjectKey(key);
  if (!safe) return false;
  return s3ObjectExists(safe);
}

/**
 * Upload artist media to S3.
 * Key shape: {S3_KEY_PREFIX}/{userId}/{uuid}.{ext}
 * e.g. artist-profile-images/uuid/uuid.jpg
 */
export async function saveArtistMedia(userId: string, file: Express.Multer.File) {
  const ext = extForMime(file.mimetype);
  const prefix = env.S3_KEY_PREFIX.replace(/^\/+|\/+$/g, "");
  const objectKey = `${prefix}/${userId}/${randomUUID()}.${ext}`;

  await s3PutObject({
    key: objectKey,
    body: file.buffer,
    contentType: file.mimetype.split(";")[0]?.trim() || "application/octet-stream",
  });

  return {
    path: objectKey,
    url: publicUrl(objectKey),
    mimeType: file.mimetype,
    size: file.size,
  };
}

/** Delete one object from S3 (no-op / ignore missing). */
export async function deleteMedia(key: string | null | undefined): Promise<void> {
  const safe = normalizeObjectKey(key ?? "");
  if (!safe) return;
  try {
    await s3DeleteObject(safe);
  } catch {
    // Best-effort cleanup; do not fail the request if an old object is already gone.
  }
}

/** Delete many object keys (e.g. previous reels). */
export async function deleteMediaMany(keys: Array<string | null | undefined>): Promise<void> {
  await Promise.all(keys.map((key) => deleteMedia(key)));
}
