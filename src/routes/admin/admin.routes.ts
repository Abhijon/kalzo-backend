import type { NextFunction, Request, Response } from "express";
import { Router } from "express";
import type { ZodType } from "zod";
import { z } from "zod";
import * as adminController from "../../controllers/admin.controller";
import { authenticate, authorize } from "../../middleware/common.middleware";
import { ApiError } from "../../utils/apiError";
import { ROLES } from "../../utils/roles";
import { validate } from "../../utils/validate";

const router = Router();

// Temporary: allow ARTIST too so you can test; remove ARTIST later and keep ADMIN only.
const adminOrArtist = [authenticate, authorize(ROLES.ADMIN, ROLES.ARTIST)] as const;

const rejectSchema = z.object({
  reason: z.string().trim().min(1, "A rejection comment is required").max(2000),
});

const artistIdParam = z.object({
  id: z.uuid("Artist id must be a valid UUID"),
});

function validateParams(schema: ZodType) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.params);
    if (!result.success) {
      const issue = result.error.issues[0];
      throw new ApiError(400, issue?.message ?? "Invalid path params");
    }
    Object.assign(req.params, result.data);
    next();
  };
}

/**
 * @swagger
 * /admin/artists:
 *   get:
 *     tags: [Admin]
 *     summary: List all artist profiles (paginated)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 100, default: 10 }
 *     responses:
 *       200:
 *         description: Flat artist list with pagination
 */
router.get("/admin/artists", ...adminOrArtist, adminController.listArtists);

/**
 * @swagger
 * /admin/artists/{id}:
 *   get:
 *     tags: [Admin]
 *     summary: Get one artist profile with media paths and verification status
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Artist detail
 *       404:
 *         description: Not found
 */
router.get("/admin/artists/:id", ...adminOrArtist, validateParams(artistIdParam), adminController.getArtist);

/**
 * @swagger
 * /admin/artists/{id}/verify:
 *   patch:
 *     tags: [Admin]
 *     summary: Mark artist as verified (visible to customers)
 *     description: Requires Digilocker KYC (`kycStatus=success`) before admin can verify.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: verificationStatus set to verified
 *       400:
 *         description: Already verified, or Digilocker KYC not completed
 *       404:
 *         description: Not found
 */
router.patch("/admin/artists/:id/verify", ...adminOrArtist, validateParams(artistIdParam), adminController.verifyArtist);

/**
 * @swagger
 * /admin/artists/{id}/reject:
 *   patch:
 *     tags: [Admin]
 *     summary: Reject artist (comment required)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [reason]
 *             properties:
 *               reason: { type: string, minLength: 1, maxLength: 2000 }
 *     responses:
 *       200:
 *         description: verificationStatus set to rejected
 *       400:
 *         description: Missing rejection comment
 *       404:
 *         description: Not found
 */
router.patch(
  "/admin/artists/:id/reject",
  ...adminOrArtist,
  validateParams(artistIdParam),
  validate(rejectSchema),
  adminController.rejectArtist,
);

const bookingIdParam = z.object({
  id: z.uuid("Booking id must be a valid UUID"),
});

/** Manual payout release after show completion (admin settlement tracking). */
router.post(
  "/admin/bookings/:id/release-payout",
  ...adminOrArtist,
  validateParams(bookingIdParam),
  adminController.releaseBookingPayout,
);

export default router;
