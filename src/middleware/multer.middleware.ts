import type { NextFunction, Request, RequestHandler, Response } from "express";
import multer from "multer";
import { ApiError } from "../utils/apiError";

const MB = 1024 * 1024;

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const VIDEO_TYPES = new Set(["video/mp4", "video/webm", "video/quicktime"]);
const IMAGE_FIELDS = new Set(["photo", "artPhoto"]);
const VIDEO_FIELDS = new Set(["faceVideo", "reels"]);

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

const artistProfileUploader = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * MB, files: 7 },
  fileFilter: (_req, file, cb) => {
    if (IMAGE_FIELDS.has(file.fieldname)) {
      if (IMAGE_TYPES.has(file.mimetype)) return cb(null, true);
      return cb(new ApiError(400, "photo and artPhoto must be JPEG, PNG or WEBP"));
    }
    if (VIDEO_FIELDS.has(file.fieldname)) {
      if (VIDEO_TYPES.has(file.mimetype)) return cb(null, true);
      return cb(new ApiError(400, "faceVideo and reels must be MP4, WEBM or MOV"));
    }
    cb(new ApiError(400, `Unexpected file field: ${file.fieldname}`));
  },
});

/** Single multipart submit: text fields + photo, artPhoto, faceVideo, reels[] */
export const uploadArtistProfile = withMulterErrors(
  artistProfileUploader.fields([
    { name: "photo", maxCount: 1 },
    { name: "artPhoto", maxCount: 1 },
    { name: "faceVideo", maxCount: 1 },
    { name: "reels", maxCount: 4 },
  ]),
);
