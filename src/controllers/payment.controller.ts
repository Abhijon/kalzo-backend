import type { Request, Response } from "express";
import { z } from "zod";
import * as paymentService from "../services/payment.service";
import { ApiError } from "../utils/apiError";
import { toBookingDto } from "../utils/bookingResponse";
import { sendSuccess } from "../utils/response";

function readIdempotencyKey(req: Request): string {
  const header = req.headers["idempotency-key"] ?? req.headers["x-idempotency-key"];
  const fromHeader = Array.isArray(header) ? header[0] : header;
  const fromBody =
    req.body && typeof req.body.idempotencyKey === "string"
      ? req.body.idempotencyKey
      : undefined;
  const key = String(fromHeader || fromBody || "").trim();
  if (!key) {
    throw new ApiError(
      400,
      "Idempotency-Key header (or idempotencyKey in body) is required",
    );
  }
  return key;
}

const verifySchema = z.object({
  razorpay_order_id: z.string().trim().min(1),
  razorpay_payment_id: z.string().trim().min(1),
  razorpay_signature: z.string().trim().min(1),
});

/** POST /bookings/:id/payment/order */
export async function createPaymentOrder(req: Request, res: Response) {
  const bookingId = String(req.params.id);
  const idempotencyKey = readIdempotencyKey(req);

  const booking = await paymentService.getPaymentStatus({
    bookingId,
    customerUserId: req.user!.id,
  });

  if (booking.paymentStatus === "paid") {
    sendSuccess(res, {
      message: "Booking is already paid.",
      reused: true,
      bookingId: booking.id,
      amountInr: booking.amountInr,
      amountPaise: booking.amountInr * 100,
      currency: "INR",
      keyId: null,
      orderId: booking.razorpayOrderId,
      paymentStatus: booking.paymentStatus,
      booking: toBookingDto(booking, "customer"),
    });
    return;
  }

  const order = await paymentService.createPaymentOrder({
    bookingId,
    customerUserId: req.user!.id,
    idempotencyKey,
  });

  sendSuccess(
    res,
    {
      message: order.reused
        ? "Existing Razorpay order returned (idempotent)."
        : "Razorpay order created.",
      ...order,
    },
    order.reused ? 200 : 201,
  );
}

/** POST /bookings/:id/payment/verify */
export async function verifyPayment(req: Request, res: Response) {
  const bookingId = String(req.params.id);
  const parsed = verifySchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ApiError(
      400,
      parsed.error.issues[0]?.message ??
        "razorpay_order_id, razorpay_payment_id, and razorpay_signature are required",
    );
  }

  const result = await paymentService.verifyPayment({
    bookingId,
    customerUserId: req.user!.id,
    orderId: parsed.data.razorpay_order_id,
    paymentId: parsed.data.razorpay_payment_id,
    signature: parsed.data.razorpay_signature,
  });

  sendSuccess(res, {
    message: result.alreadyPaid
      ? "Payment already verified."
      : "Payment verified. Booking is paid.",
    alreadyPaid: result.alreadyPaid,
    booking: toBookingDto(result.booking, "customer"),
  });
}

/** GET /bookings/:id/payment */
export async function getPayment(req: Request, res: Response) {
  const booking = await paymentService.getPaymentStatus({
    bookingId: String(req.params.id),
    customerUserId: req.user!.id,
  });
  sendSuccess(res, {
    bookingId: booking.id,
    amountInr: booking.amountInr,
    paymentStatus: booking.paymentStatus,
    razorpayOrderId: booking.razorpayOrderId,
    razorpayPaymentId: booking.razorpayPaymentId,
    paidAt: booking.paidAt ? booking.paidAt.toISOString() : null,
    booking: toBookingDto(booking, "customer"),
  });
}
