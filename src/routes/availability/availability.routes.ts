import type { NextFunction, Request, Response } from "express";
import { Router } from "express";
import type { ZodType } from "zod";
import { z } from "zod";
import * as availabilityController from "../../controllers/availability.controller";
import { authenticate, authorize } from "../../middleware/common.middleware";
import { ApiError } from "../../utils/apiError";
import { ROLES } from "../../utils/roles";
import { validate } from "../../utils/validate";

const router = Router();
const artistOnly = [authenticate, authorize(ROLES.ARTIST)] as const;

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

const setDaySchema = z
  .object({
    weekday: z.union([z.number().int().min(0).max(6), z.string()]).optional(),
    day: z.string().optional(),
    isActive: z.boolean(),
  })
  .refine((b) => b.weekday !== undefined || b.day !== undefined, {
    message: "weekday or day is required",
    path: ["weekday"],
  });

/**
 * @swagger
 * /artist/availability:
 *   get:
 *     tags: [Availability]
 *     summary: Artist — list Mon–Sun with isActive (recurring every week)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Seven weekdays; pattern carries to every week
 */
router.get("/artist/availability", ...artistOnly, availabilityController.listMyAvailability);

/**
 * @swagger
 * /artist/availability/days:
 *   patch:
 *     tags: [Availability]
 *     summary: Artist — toggle a weekday available / unavailable
 *     description: |
 *       Recurring weekly pattern. Example Monday+Tuesday active stays active every week
 *       until you PATCH them again. weekday 0=Sunday … 6=Saturday, or day name "monday".
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [isActive]
 *             properties:
 *               weekday: { type: integer, minimum: 0, maximum: 6, example: 1 }
 *               day: { type: string, example: monday }
 *               isActive: { type: boolean, example: true }
 *           example:
 *             day: monday
 *             isActive: true
 *     responses:
 *       200:
 *         description: Weekday updated
 *       400:
 *         description: Invalid body
 */
router.patch(
  "/artist/availability/days",
  ...artistOnly,
  validate(setDaySchema),
  availabilityController.setDayActive,
);

/**
 * @swagger
 * /artists/{id}/availability:
 *   get:
 *     tags: [Availability]
 *     summary: Public Mon–Sun availability for a verified artist
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Weekdays with isActive (green/available vs unavailable in UI)
 *       404:
 *         description: Artist not found
 */
router.get(
  "/artists/:id/availability",
  validateParams(uuidParam),
  availabilityController.listArtistPublicAvailability,
);

export default router;
