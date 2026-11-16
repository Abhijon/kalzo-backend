import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

const UPLOAD_ROOT = path.resolve(process.cwd(), "uploads");

/** Extension from mime; falls back to bin. */
function extForMime(mime: string): string {
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "video/mp4": "mp4",
    "video/webm": "webm",
    "video/quicktime": "mov",
  };
  return map[mime] ?? "bin";
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
