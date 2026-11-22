import { Router } from "express";
import * as mediaController from "../../controllers/media.controller";
import { authenticate, authorize } from "../../middleware/common.middleware";
import { ApiError } from "../../utils/apiError";
import { sendSuccess } from "../../utils/response";
import { ROLES } from "../../utils/roles";
import * as mediaService from "../../services/media.service";

const router = Router();
const artistOnly = [authenticate, authorize(ROLES.ARTIST)] as const;

/**
 * @swagger
 * /media/uploads:
 *   post:
 *     tags: [Media]
 *     summary: Start direct-to-S3 upload (presigned)
 *     description: |
 *       Files ≤ 5MB get a single PUT URL (`mode=single`).
 *       Larger files use S3 multipart (`mode=multipart`) with 5MB parts.
 *       Frontend uploads bytes to S3, then calls /media/uploads/complete for multipart.
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [purpose, contentType, fileSize]
 *             properties:
 *               purpose:
 *                 type: string
 *                 enum: [photo, artPhoto, faceVideo, reel]
 *               contentType: { type: string, example: video/webm }
 *               fileSize: { type: integer, example: 12000000 }
 *               fileName: { type: string }
 *     responses:
 *       201:
 *         description: Upload session started
 *       400:
 *         description: Invalid purpose/type/size
 */
router.post("/media/uploads", ...artistOnly, mediaController.startUpload);

/**
 * @swagger
 * /media/uploads/presign-part:
 *   post:
 *     tags: [Media]
 *     summary: Get or refresh a multipart part presigned URL
 *     description: Call again if a previous URL expired or a part upload failed with 403.
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [key, uploadId, partNumber]
 *             properties:
 *               key: { type: string }
 *               uploadId: { type: string }
 *               partNumber: { type: integer, minimum: 1 }
 *     responses:
 *       200:
 *         description: Presigned part URL
 */
router.post("/media/uploads/presign-part", ...artistOnly, mediaController.presignPart);

/**
 * @swagger
 * /media/uploads/complete:
 *   post:
 *     tags: [Media]
 *     summary: Complete S3 multipart upload (merge parts)
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [key, uploadId, parts]
 *             properties:
 *               key: { type: string }
 *               uploadId: { type: string }
 *               parts:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [partNumber, etag]
 *                   properties:
 *                     partNumber: { type: integer }
 *                     etag: { type: string, description: ETag header from the part PUT }
 *     responses:
 *       200:
 *         description: Final object key + public URL
 */
router.post("/media/uploads/complete", ...artistOnly, mediaController.completeUpload);

/**
 * @swagger
 * /media/uploads/abort:
 *   post:
 *     tags: [Media]
 *     summary: Abort an in-progress multipart upload
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [key, uploadId]
 *             properties:
 *               key: { type: string }
 *               uploadId: { type: string }
 *     responses:
 *       200:
 *         description: Upload aborted
 */
router.post("/media/uploads/abort", ...artistOnly, mediaController.abortUpload);

/**
 * @swagger
 * /media/discard:
 *   post:
 *     tags: [Media]
 *     summary: Delete an owned S3 object (replace / abandoned upload)
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [key]
 *             properties:
 *               key: { type: string }
 *     responses:
 *       200:
 *         description: Object deleted (best-effort)
 *       400:
 *         description: Invalid or unowned key
 */
router.post("/media/discard", ...artistOnly, mediaController.discardMedia);

/**
 * @swagger
 * /media/url:
 *   get:
 *     tags: [Media]
 *     summary: Resolve an S3 object key to a public URL
 *     parameters:
 *       - in: query
 *         name: path
 *         required: true
 *         description: S3 object key, e.g. artist-profile-images/{userId}/{file}.jpg
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Public media URL
 *       400:
 *         description: path missing/invalid
 *       404:
 *         description: Object not found in S3
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
 * @swagger
 * /media/{objectKey}:
 *   get:
 *     tags: [Media]
 *     summary: Redirect to the public S3 URL for an object key
 *     parameters:
 *       - in: path
 *         name: objectKey
 *         required: true
 *         description: Full object key path (may include slashes)
 *         schema: { type: string }
 *     responses:
 *       302:
 *         description: Redirect to S3
 *       400:
 *         description: Invalid path
 *       404:
 *         description: Not found
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
