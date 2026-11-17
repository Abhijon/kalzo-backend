import { randomUUID } from "crypto";
import { access, mkdir, writeFile } from "fs/promises";
import path from "path";
import type { Request } from "express";

export const UPLOAD_ROOT = path.resolve(process.cwd(), "uploads");

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
  const absolute = path.resolve(UPLOAD_ROOT, cleaned);
  const rootWithSep = UPLOAD_ROOT.endsWith(path.sep) ? UPLOAD_ROOT : UPLOAD_ROOT + path.sep;
  if (absolute !== UPLOAD_ROOT && !absolute.startsWith(rootWithSep)) return "";
  return cleaned;
}

export function absolutePathForKey(key: string): string | null {
  const safe = normalizeObjectKey(key);
  if (!safe) return null;
  return path.join(UPLOAD_ROOT, safe);
}

export async function mediaExists(key: string): Promise<boolean> {
  const absolute = absolutePathForKey(key);
  if (!absolute) return false;
  try {
    await access(absolute);
    return true;
  } catch {
    return false;
  }
}

/** Absolute browser URL for a media object key (local uploads). */
export function publicUrl(req: Request, key: string): string {
  const safe = normalizeObjectKey(key);
  const host = req.get("host") || "localhost:8000";
  const proto = req.protocol || "http";
  const encoded = safe
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
  return `${proto}://${host}/api/v1/media/${encoded}`;
}

/**
 * Save an upload under uploads/ with an S3-ready object key:
 * artists/{userId}/{uuid}.{ext}
 * Swap writeFile for S3 PutObject later; keep returning the same `path` shape.
 */
export async function saveArtistMedia(userId: string, file: Express.Multer.File) {
  const ext = extForMime(file.mimetype);
  const objectKey = `artists/${userId}/${randomUUID()}.${ext}`;
  const absolute = path.join(UPLOAD_ROOT, objectKey);
  await mkdir(path.dirname(absolute), { recursive: true });
  await writeFile(absolute, file.buffer);
  return { path: objectKey, mimeType: file.mimetype, size: file.size };
}
