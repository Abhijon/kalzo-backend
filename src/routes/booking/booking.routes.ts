import type { NextFunction, Request, Response } from "express";
import { Router } from "express";
import type { ZodType } from "zod";
import { z } from "zod";
import * as bookingController from "../../controllers/booking.controller";
import { authenticate, authorize } from "../../middleware/common.middleware";
import { ApiError } from "../../utils/apiError";
import { ROLES } from "../../utils/roles";
import { validate } from "../../utils/validate";

const router = Router();
const customerOnly = [authenticate, authorize(ROLES.CUSTOMER)] as const;
const artistOnly = [authenticate, authorize(ROLES.ARTIST)] as const;
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

const createSchema = z
  .object({
    artistId: z.uuid().optional(),
    artistProfileId: z.uuid().optional(),
    eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    address: z.string().trim().min(5).max(500),
    guests: z.string().trim().max(100).optional(),
    note: z.string().trim().max(2000).optional(),
    amountInr: z.number().int().min(0).max(10_000_000).optional(),
  })
  .refine((b) => Boolean(b.artistId || b.artistProfileId), {
    message: "artistId is required",
    path: ["artistId"],
  })
  .refine((b) => Boolean(b.eventDate || b.date), {
    message: "eventDate is required (YYYY-MM-DD)",
    path: ["eventDate"],
  });

const statusSchema = z.object({
  status: z.enum(["accepted", "rejected", "job_started", "completed"]),
});

/**
 * @swagger
 * /booking-statuses:
 *   get:
 *     tags: [Bookings]
 *     summary: List all BookingStatus enum values (public)
 *     description: Returns pending, accepted, rejected, job_started, completed for filters and UI tabs.
 *     responses:
 *       200:
 *         description: Booking status enum values
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     statuses:
 *                       type: array
 *                       items:
 *                         type: string
 *                         enum: [pending, accepted, rejected, job_started, completed]
 *                       example: [pending, accepted, rejected, job_started, completed]
 */
router.get("/booking-statuses", bookingController.listBookingStatuses);

/**
 * @swagger
 * /bookings:
 *   post:
 *     tags: [Bookings]
 *     summary: Customer creates a booking request (no payment)
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [artistId, eventDate, address]
 *             properties:
 *               artistId: { type: string, format: uuid }
 *               eventDate: { type: string, format: date, example: "2026-11-24" }
 *               address: { type: string }
 *               guests: { type: string }
 *               note: { type: string }
 *               amountInr: { type: integer }
 *     responses:
 *       201:
 *         description: Booking created as pending
 */
router.post("/bookings", ...customerOnly, validate(createSchema), bookingController.createBooking);

/**
 * @swagger
 * /bookings:
 *   get:
 *     tags: [Bookings]
 *     summary: Customer — list my bookings (paginated)
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
 *         description: Customer booking list with pagination
 *       400:
 *         description: Invalid pagination query
 */
router.get("/bookings", ...customerOnly, bookingController.listMyBookings);

/**
 * @swagger
 * /bookings/{id}:
 *   get:
 *     tags: [Bookings]
 *     summary: Get one booking by id (customer or artist on the booking)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Booking detail
 *       404:
 *         description: Not found
 */
router.get("/bookings/:id", ...authed, validateParams(uuidParam), bookingController.getBookingById);

/**
 * @swagger
 * /artist/bookings:
 *   get:
 *     tags: [Bookings]
 *     summary: Artist — list paid bookings only (paginated, optional status filter)
 *     description: Unpaid / payment-pending bookings are hidden until paymentStatus is paid.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 100, default: 10 }
 *       - in: query
 *         name: status
 *         required: false
 *         description: Filter by BookingStatus enum. Omit for all paid bookings.
 *         schema:
 *           type: string
 *           enum: [pending, accepted, rejected, job_started, completed]
 *           example: pending
 *     responses:
 *       200:
 *         description: Artist booking list with pagination
 *       400:
 *         description: Invalid status or pagination query
 */
router.get("/artist/bookings", ...artistOnly, bookingController.listArtistBookings);

/**
 * @swagger
 * /artist/bookings/{id}/status:
 *   patch:
 *     tags: [Bookings]
 *     summary: Artist — update booking status
 *     description: Transitions only — pending→accepted|rejected, accepted→job_started|rejected, job_started→completed
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Booking UUID
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [accepted, rejected, job_started, completed]
 *                 example: accepted
 *           example:
 *             status: accepted
 *     responses:
 *       200:
 *         description: Status updated
 *       400:
 *         description: Invalid transition or body
 *       404:
 *         description: Booking not found
 */
router.patch(
  "/artist/bookings/:id/status",
  ...artistOnly,
  validateParams(uuidParam),
  validate(statusSchema),
  bookingController.updateBookingStatus,
);

export default router;
