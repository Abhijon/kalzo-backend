import { Router } from "express";
import express from "express";
import { ApiError } from "../../utils/apiError";
import { sendSuccess } from "../../utils/response";
import * as mediaService from "../../services/media.service";

const router = Router();

/**
 * GET /media/url?path=artists/{userId}/{file}
 * Returns a localhost (or current host) URL that streams the file from uploads/.
 */
router.get("/media/url", async (req, res) => {
  const key = mediaService.normalizeObjectKey(String(req.query.path ?? ""));
  if (!key) throw new ApiError(400, "path is required");

  const exists = await mediaService.mediaExists(key);
  if (!exists) throw new ApiError(404, "Media file not found");

  sendSuccess(res, {
    path: key,
    url: mediaService.publicUrl(req, key),
    signedUrl: mediaService.publicUrl(req, key),
  });
});

/**
 * GET /media/artists/... — serve local uploads (dev stand-in for S3).
 * Path traversal is blocked by express.static root + normalizeObjectKey for /url.
 */
router.use(
  "/media",
  express.static(mediaService.UPLOAD_ROOT, {
    fallthrough: false,
    index: false,
    setHeaders(res) {
      res.setHeader("Cache-Control", "private, max-age=600");
      // Vite (different origin/port) needs to load images/videos in <img>/<video>.
      res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
      res.setHeader("Access-Control-Allow-Origin", "*");
    },
  }),
);

export default router;
