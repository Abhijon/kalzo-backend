import type { NextFunction, Request, RequestHandler, Response } from "express";
import multer from "multer";
import { ApiError } from "../utils/apiError";

const MB = 1024 * 1024;

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"];

const multerMessages: Partial<Record<multer.ErrorCode, string>> = {
  LIMIT_FILE_SIZE: "File is too large",
  LIMIT_FILE_COUNT: "Too many files",
  LIMIT_UNEXPECTED_FILE: "Unexpected file field",
};

function createUploader(allowedTypes: string[], maxSizeMb: number, label: string) {
  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: maxSizeMb * MB, files: 1 },
    fileFilter: (_req, file, cb) => {
      if (allowedTypes.includes(file.mimetype)) return cb(null, true);
      cb(new ApiError(400, `Only ${label} files are allowed`));
    },
  });
}

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

const imageUploader = createUploader(IMAGE_TYPES, 5, "JPEG, PNG or WEBP image");
const videoUploader = createUploader(VIDEO_TYPES, 100, "MP4, WEBM or MOV video");

export const uploadImage = (field: string) => withMulterErrors(imageUploader.single(field));
export const uploadVideo = (field: string) => withMulterErrors(videoUploader.single(field));
