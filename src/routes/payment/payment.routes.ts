import type { NextFunction, Request, Response } from "express";
import { Router } from "express";
import type { ZodType } from "zod";
import { z } from "zod";
import * as paymentController from "../../controllers/payment.controller";
import { authenticate, authorize } from "../../middleware/common.middleware";
import { ApiError } from "../../utils/apiError";
import { ROLES } from "../../utils/roles";

const router = Router();
const customerOnly = [authenticate, authorize(ROLES.CUSTOMER)] as const;

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
 * /bookings/{id}/payment/order:
 *   post:
 *     tags: [Payments]
 *     summary: Create Razorpay order for a booking (idempotent)
 *     description: |
 *       Call after POST /bookings. Pass `Idempotency-Key` header (8–128 chars).
 *       Repeating the same key returns the same order — no duplicate charges.
 *       If the booking already has an open order, that order is reused.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: header
 *         name: Idempotency-Key
 *         required: true
 *         schema: { type: string, minLength: 8, maxLength: 128 }
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               idempotencyKey: { type: string, description: Alternative to header }
 *     responses:
 *       201:
 *         description: New Razorpay order created
 *       200:
 *         description: Existing order reused (idempotent) or already paid
 *       400:
 *         description: Not payable / missing Idempotency-Key
 *       403:
 *         description: Not the booking customer
 *       404:
 *         description: Booking not found
 *       409:
 *         description: Idempotency key conflict or already paid
 *       503:
 *         description: Razorpay keys not configured
 */
router.post(
  "/bookings/:id/payment/order",
  ...customerOnly,
  validateParams(uuidParam),
  paymentController.createPaymentOrder,
);

/**
 * @swagger
 * /bookings/{id}/payment/verify:
 *   post:
 *     tags: [Payments]
 *     summary: Verify Razorpay payment signature and mark booking paid
 *     description: |
 *       After Checkout success, send order/payment/signature.
 *       Safe to retry — already-paid with the same payment returns 200.
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
 *             required: [razorpay_order_id, razorpay_payment_id, razorpay_signature]
 *             properties:
 *               razorpay_order_id: { type: string }
 *               razorpay_payment_id: { type: string }
 *               razorpay_signature: { type: string }
 *     responses:
 *       200:
 *         description: Payment verified (or already verified)
 *       400:
 *         description: Invalid signature or body
 *       403:
 *         description: Not the booking customer
 *       404:
 *         description: Booking not found
 *       409:
 *         description: Already paid with a different payment
 */
router.post(
  "/bookings/:id/payment/verify",
  ...customerOnly,
  validateParams(uuidParam),
  paymentController.verifyPayment,
);

/**
 * @swagger
 * /bookings/{id}/payment:
 *   get:
 *     tags: [Payments]
 *     summary: Get payment status for a booking
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Payment status
 *       403:
 *         description: Not the booking customer
 *       404:
 *         description: Booking not found
 */
router.get(
  "/bookings/:id/payment",
  ...customerOnly,
  validateParams(uuidParam),
  paymentController.getPayment,
);

export default router;
