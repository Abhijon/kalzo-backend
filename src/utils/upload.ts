/** S3 multipart minimum part size (except last part). */
export const UPLOAD_PART_SIZE = 5 * 1024 * 1024;

/** Presigned URL lifetime (seconds). Frontend re-requests on expiry. */
export const UPLOAD_URL_EXPIRES_IN = 900;

export const UPLOAD_PURPOSES = ["photo", "artPhoto", "faceVideo", "reel"] as const;
export type UploadPurpose = (typeof UPLOAD_PURPOSES)[number];

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const VIDEO_TYPES = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-matroska",
]);

export function normalizeContentType(raw: string): string {
  return (raw.split(";")[0] ?? "").trim().toLowerCase();
}

export function isAllowedUploadContentType(purpose: UploadPurpose, contentType: string): boolean {
  const mime = normalizeContentType(contentType);
  if (purpose === "photo" || purpose === "artPhoto") return IMAGE_TYPES.has(mime);
  return VIDEO_TYPES.has(mime);
}

export function extForUploadMime(mime: string): string {
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "video/mp4": "mp4",
    "video/webm": "webm",
    "video/quicktime": "mov",
    "video/x-matroska": "webm",
  };
  return map[normalizeContentType(mime)] ?? "bin";
}

export function partCountForSize(fileSize: number, partSize = UPLOAD_PART_SIZE): number {
  return Math.max(1, Math.ceil(fileSize / partSize));
}
