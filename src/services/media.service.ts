import { randomUUID } from "crypto";
import { env } from "../config/env";
import {
  s3AbortMultipartUpload,
  s3CompleteMultipartUpload,
  s3CreateMultipartUpload,
  s3DeleteObject,
  s3ObjectExists,
  s3ObjectUrl,
  s3PresignPutObject,
  s3PresignUploadPart,
  s3PutObject,
} from "../lib/s3";
import { ApiError } from "../utils/apiError";
import {
  UPLOAD_PART_SIZE,
  UPLOAD_URL_EXPIRES_IN,
  extForUploadMime,
  isAllowedUploadContentType,
  normalizeContentType,
  partCountForSize,
  type UploadPurpose,
} from "../utils/upload";

/** Extension from mime; falls back to bin. */
function extForMime(mime: string): string {
  return extForUploadMime(mime);
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

function keyPrefix(): string {
  return env.S3_KEY_PREFIX.replace(/^\/+|\/+$/g, "");
}

/** Keys must live under {prefix}/{userId}/… */
export function assertOwnedMediaKey(userId: string, key: string): string {
  const safe = normalizeObjectKey(key);
  const expected = `${keyPrefix()}/${userId}/`;
  if (!safe || !safe.startsWith(expected)) {
    throw new ApiError(400, "Invalid media key for this artist");
  }
  return safe;
}

export async function assertOwnedMediaKeysExist(
  userId: string,
  keys: string[],
): Promise<string[]> {
  const safeKeys = keys.map((k) => assertOwnedMediaKey(userId, k));
  const results = await Promise.all(safeKeys.map((k) => mediaExists(k)));
  const missing = safeKeys.filter((_, i) => !results[i]);
  if (missing.length) {
    throw new ApiError(400, "One or more media files were not found in storage");
  }
  return safeKeys;
}

function buildObjectKey(userId: string, contentType: string): string {
  const ext = extForMime(contentType);
  return `${keyPrefix()}/${userId}/${randomUUID()}.${ext}`;
}

/**
 * Upload artist media to S3 (server-side / legacy multipart path).
 * Key shape: {S3_KEY_PREFIX}/{userId}/{uuid}.{ext}
 */
export async function saveArtistMedia(userId: string, file: Express.Multer.File) {
  const contentType =
    file.mimetype.split(";")[0]?.trim() || "application/octet-stream";
  const objectKey = buildObjectKey(userId, contentType);

  await s3PutObject({
    key: objectKey,
    body: file.buffer,
    contentType,
  });

  return {
    path: objectKey,
    url: publicUrl(objectKey),
    mimeType: file.mimetype,
    size: file.size,
  };
}

export type StartUploadInput = {
  userId: string;
  purpose: UploadPurpose;
  contentType: string;
  fileSize: number;
};

export type StartUploadResult =
  | {
      mode: "single";
      key: string;
      uploadUrl: string;
      expiresIn: number;
      partSize: number;
    }
  | {
      mode: "multipart";
      key: string;
      uploadId: string;
      partSize: number;
      partCount: number;
      expiresIn: number;
    };

/** Start a direct-to-S3 upload. ≤5MB → single PUT; larger → multipart. */
export async function startDirectUpload(
  input: StartUploadInput,
): Promise<StartUploadResult> {
  const contentType = normalizeContentType(input.contentType);
  if (!isAllowedUploadContentType(input.purpose, contentType)) {
    throw new ApiError(400, `Unsupported contentType for ${input.purpose}`);
  }
  if (!Number.isFinite(input.fileSize) || input.fileSize < 1) {
    throw new ApiError(400, "fileSize must be a positive number");
  }
  // Match previous multer limit
  const maxBytes = 100 * 1024 * 1024;
  if (input.fileSize > maxBytes) {
    throw new ApiError(400, "File is too large (max 100 MB per file)");
  }

  const key = buildObjectKey(input.userId, contentType);
  const expiresIn = UPLOAD_URL_EXPIRES_IN;

  if (input.fileSize <= UPLOAD_PART_SIZE) {
    const uploadUrl = await s3PresignPutObject({ key, contentType, expiresIn });
    return {
      mode: "single",
      key,
      uploadUrl,
      expiresIn,
      partSize: UPLOAD_PART_SIZE,
    };
  }

  const { uploadId } = await s3CreateMultipartUpload({ key, contentType });
  return {
    mode: "multipart",
    key,
    uploadId,
    partSize: UPLOAD_PART_SIZE,
    partCount: partCountForSize(input.fileSize),
    expiresIn,
  };
}

export async function presignUploadPart(input: {
  userId: string;
  key: string;
  uploadId: string;
  partNumber: number;
}): Promise<{ uploadUrl: string; expiresIn: number; partNumber: number }> {
  const key = assertOwnedMediaKey(input.userId, input.key);
  if (!input.uploadId?.trim()) throw new ApiError(400, "uploadId is required");
  if (!Number.isInteger(input.partNumber) || input.partNumber < 1 || input.partNumber > 10000) {
    throw new ApiError(400, "partNumber must be an integer between 1 and 10000");
  }

  const expiresIn = UPLOAD_URL_EXPIRES_IN;
  const uploadUrl = await s3PresignUploadPart({
    key,
    uploadId: input.uploadId,
    partNumber: input.partNumber,
    expiresIn,
  });
  return { uploadUrl, expiresIn, partNumber: input.partNumber };
}

export async function completeDirectUpload(input: {
  userId: string;
  key: string;
  uploadId: string;
  parts: Array<{ partNumber: number; etag: string }>;
}): Promise<{ key: string; url: string }> {
  const key = assertOwnedMediaKey(input.userId, input.key);
  if (!input.uploadId?.trim()) throw new ApiError(400, "uploadId is required");
  if (!Array.isArray(input.parts) || input.parts.length < 1) {
    throw new ApiError(400, "parts must include at least one uploaded part");
  }

  const parts = input.parts.map((p) => {
    const etag = String(p.etag ?? "").trim();
    if (!Number.isInteger(p.partNumber) || p.partNumber < 1) {
      throw new ApiError(400, "Each part needs a valid partNumber");
    }
    if (!etag) throw new ApiError(400, "Each part needs an etag from S3");
    return { partNumber: p.partNumber, etag };
  });

  await s3CompleteMultipartUpload({
    key,
    uploadId: input.uploadId,
    parts,
  });

  return { key, url: publicUrl(key) };
}

export async function abortDirectUpload(input: {
  userId: string;
  key: string;
  uploadId: string;
}): Promise<void> {
  const key = assertOwnedMediaKey(input.userId, input.key);
  if (!input.uploadId?.trim()) throw new ApiError(400, "uploadId is required");
  try {
    await s3AbortMultipartUpload({ key, uploadId: input.uploadId });
  } catch {
    // Best-effort cleanup
  }
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
