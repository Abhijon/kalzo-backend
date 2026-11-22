import type { Request, Response } from "express";
import { z } from "zod";
import * as mediaService from "../services/media.service";
import { ApiError } from "../utils/apiError";
import { sendSuccess } from "../utils/response";
import { UPLOAD_PURPOSES } from "../utils/upload";

const startSchema = z.object({
  purpose: z.enum(UPLOAD_PURPOSES),
  contentType: z.string().trim().min(3).max(100),
  fileSize: z.number().int().positive(),
  fileName: z.string().trim().max(200).optional(),
});

const presignPartSchema = z.object({
  key: z.string().trim().min(1).max(500),
  uploadId: z.string().trim().min(1).max(200),
  partNumber: z.number().int().min(1).max(10000),
});

const completeSchema = z.object({
  key: z.string().trim().min(1).max(500),
  uploadId: z.string().trim().min(1).max(200),
  parts: z
    .array(
      z.object({
        partNumber: z.number().int().min(1).max(10000),
        etag: z.string().trim().min(1).max(200),
      }),
    )
    .min(1)
    .max(10000),
});

const abortSchema = z.object({
  key: z.string().trim().min(1).max(500),
  uploadId: z.string().trim().min(1).max(200),
});

const discardSchema = z.object({
  key: z.string().trim().min(1).max(500),
});

/** POST /media/uploads — start single or multipart direct upload */
export async function startUpload(req: Request, res: Response) {
  const parsed = startSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ApiError(400, parsed.error.issues[0]?.message ?? "Invalid upload request");
  }

  const result = await mediaService.startDirectUpload({
    userId: req.user!.id,
    purpose: parsed.data.purpose,
    contentType: parsed.data.contentType,
    fileSize: parsed.data.fileSize,
  });

  sendSuccess(res, result, 201);
}

/** POST /media/uploads/presign-part — refresh/get one part URL */
export async function presignPart(req: Request, res: Response) {
  const parsed = presignPartSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ApiError(400, parsed.error.issues[0]?.message ?? "Invalid presign request");
  }

  const result = await mediaService.presignUploadPart({
    userId: req.user!.id,
    ...parsed.data,
  });
  sendSuccess(res, result);
}

/** POST /media/uploads/complete — finish multipart merge on S3 */
export async function completeUpload(req: Request, res: Response) {
  const parsed = completeSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ApiError(400, parsed.error.issues[0]?.message ?? "Invalid complete request");
  }

  const result = await mediaService.completeDirectUpload({
    userId: req.user!.id,
    ...parsed.data,
  });
  sendSuccess(res, result);
}

/** POST /media/uploads/abort — cancel an in-progress multipart upload */
export async function abortUpload(req: Request, res: Response) {
  const parsed = abortSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ApiError(400, parsed.error.issues[0]?.message ?? "Invalid abort request");
  }

  await mediaService.abortDirectUpload({
    userId: req.user!.id,
    ...parsed.data,
  });
  sendSuccess(res, { message: "Upload aborted." });
}

/** POST /media/discard — delete an owned object (e.g. replaced before profile submit) */
export async function discardMedia(req: Request, res: Response) {
  const parsed = discardSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ApiError(400, parsed.error.issues[0]?.message ?? "Invalid discard request");
  }
  const key = mediaService.assertOwnedMediaKey(req.user!.id, parsed.data.key);
  await mediaService.deleteMedia(key);
  sendSuccess(res, { message: "Media discarded.", key });
}
