import type { NextFunction, Request, RequestHandler, Response } from "express";
import multer from "multer";
import { ApiError } from "../utils/apiError";

const MB = 1024 * 1024;

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const VIDEO_TYPES = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime",
  // Chrome MediaRecorder often labels WebM as Matroska
  "video/x-matroska",
]);
const IMAGE_FIELDS = new Set(["photo", "artPhoto"]);
const VIDEO_FIELDS = new Set(["faceVideo", "reels"]);
const VIDEO_EXTS = /\.(mp4|webm|mov|mkv)$/i;
const IMAGE_EXTS = /\.(jpe?g|png|webp)$/i;

const multerMessages: Partial<Record<multer.ErrorCode, string>> = {
  LIMIT_FILE_SIZE: "File is too large (max 100 MB per file)",
  LIMIT_FILE_COUNT: "Too many files",
  LIMIT_UNEXPECTED_FILE: "Unexpected file field",
};

function withMulterErrors(handler: RequestHandler): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    handler(req, res, (err?: unknown) => {
      if (err instanceof multer.MulterError) {
        return next(new ApiError(400, multerMessages[err.code] ?? err.message));
      }
      next(err);
    });
  };
}

function baseMimeOf(file: Express.Multer.File): string {
  // Browsers may send "video/webm;codecs=vp9,opus" — compare base type only
  return (file.mimetype.split(";")[0] ?? "").trim().toLowerCase();
}

function isAllowedVideo(file: Express.Multer.File): boolean {
  const mime = baseMimeOf(file);
  if (VIDEO_TYPES.has(mime)) return true;
  // Some pickers leave type empty / octet-stream; fall back to filename
  if (!mime || mime === "application/octet-stream") {
    return VIDEO_EXTS.test(file.originalname || "");
  }
  return false;
}

function isAllowedImage(file: Express.Multer.File): boolean {
  const mime = baseMimeOf(file);
  if (IMAGE_TYPES.has(mime)) return true;
  if (!mime || mime === "application/octet-stream") {
    return IMAGE_EXTS.test(file.originalname || "");
  }
  return false;
}

const artistProfileUploader = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * MB, files: 7 },
  fileFilter: (_req, file, cb) => {
    const baseMime = baseMimeOf(file);

    if (IMAGE_FIELDS.has(file.fieldname)) {
      if (isAllowedImage(file)) return cb(null, true);
      return cb(new ApiError(400, "photo and artPhoto must be JPEG, PNG or WEBP"));
    }
    if (VIDEO_FIELDS.has(file.fieldname)) {
      if (isAllowedVideo(file)) return cb(null, true);
      return cb(
        new ApiError(
          400,
          `faceVideo and reels must be MP4, WEBM or MOV (got: ${baseMime || "empty"})`,
        ),
      );
    }
    cb(new ApiError(400, `Unexpected file field: ${file.fieldname}`));
  },
});
/** Single multipart submit: text fields + photo, artPhoto, faceVideo, reels[] */
const uploadArtistProfileFiles = withMulterErrors(
  artistProfileUploader.fields([
    { name: "photo", maxCount: 1 },
    { name: "artPhoto", maxCount: 1 },
    { name: "faceVideo", maxCount: 1 },
    { name: "reels", maxCount: 4 },
  ]),
);

/** Run multer only for multipart; JSON profile submits (S3 keys) skip it. */
export const uploadArtistProfile: RequestHandler = (req, res, next) => {
  const ct = String(req.headers["content-type"] ?? "");
  if (ct.includes("multipart/form-data")) {
    return uploadArtistProfileFiles(req, res, next);
  }
  next();
};
