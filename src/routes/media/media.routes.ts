import { Router } from "express";
import { ApiError } from "../../utils/apiError";
import { sendSuccess } from "../../utils/response";
import * as mediaService from "../../services/media.service";

const router = Router();

/**
 * GET /media/url?path=artist-profile-images/{userId}/{file}
 * Resolves a stored S3 object key to a public S3 URL.
 */
router.get("/media/url", async (req, res) => {
  const key = mediaService.normalizeObjectKey(String(req.query.path ?? ""));
  if (!key) throw new ApiError(400, "path is required");

  const exists = await mediaService.mediaExists(key);
  if (!exists) throw new ApiError(404, "Media file not found");

  const url = mediaService.publicUrl(key);
  sendSuccess(res, {
    path: key,
    url,
    signedUrl: url,
  });
});

/**
 * GET /media/* — redirect to the public S3 object URL.
 * Keeps older /api/v1/media/... links working after the S3 move.
 */
router.get("/media/*objectKey", async (req, res) => {
  const raw = String(req.params.objectKey ?? "").replace(/^\//, "");
  const key = mediaService.normalizeObjectKey(decodeURIComponent(raw));
  if (!key) throw new ApiError(400, "Invalid media path");

  const exists = await mediaService.mediaExists(key);
  if (!exists) throw new ApiError(404, "Media file not found");

  res.redirect(302, mediaService.publicUrl(key));
});

export default router;
