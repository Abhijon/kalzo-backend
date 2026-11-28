import type { NextFunction, Request, Response } from "express";
import { Router } from "express";
import type { ZodType } from "zod";
import { z } from "zod";
import * as reviewController from "../../controllers/review.controller";
import { authenticate, authorize } from "../../middleware/common.middleware";
import { ApiError } from "../../utils/apiError";
import { ROLES } from "../../utils/roles";

const router = Router();
const customerOnly = [authenticate, authorize(ROLES.CUSTOMER)] as const;
const authed = [authenticate] as const;

const uuidParam = z.object({ id: z.uuid("Must be a valid UUID") });

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
 * /bookings/{id}/review:
 *   post:
 *     tags: [Reviews]
 *     summary: Customer creates a review after booking is completed
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
 *             required: [rating, body]
 *             properties:
 *               rating: { type: integer, minimum: 1, maximum: 5 }
 *               body: { type: string, minLength: 1, maxLength: 2000 }
 *               tags:
 *                 type: array
 *                 maxItems: 12
 *                 items: { type: string, maxLength: 40 }
 *     responses:
 *       201:
 *         description: Review created
 *       400:
 *         description: Booking not completed / invalid body
 *       409:
 *         description: Already reviewed
 */
router.post(
  "/bookings/:id/review",
  ...customerOnly,
  validateParams(uuidParam),
  reviewController.createReview,
);

/**
 * @swagger
 * /bookings/{id}/review:
 *   get:
 *     tags: [Reviews]
 *     summary: Get review for a booking (customer or artist)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Review payload (review may be null)
 */
router.get(
  "/bookings/:id/review",
  ...authed,
  validateParams(uuidParam),
  reviewController.getBookingReview,
);

/**
 * @swagger
 * /artists/{id}/reviews:
 *   get:
 *     tags: [Reviews]
 *     summary: Public paginated reviews for an artist
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 100, default: 10 }
 *     responses:
 *       200:
 *         description: Reviews + avgRating + breakdown
 *       404:
 *         description: Artist not found
 */
router.get(
  "/artists/:id/reviews",
  validateParams(uuidParam),
  reviewController.listArtistReviews,
);

export default router;
