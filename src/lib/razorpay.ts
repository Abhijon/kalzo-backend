import crypto from "crypto";
import Razorpay from "razorpay";
import { env } from "../config/env";
import { ApiError } from "../utils/apiError";

export function assertRazorpayConfigured() {
  if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
    throw new ApiError(
      503,
      "Razorpay is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET (test keys first).",
    );
  }
}

export function getRazorpayClient() {
  assertRazorpayConfigured();
  return new Razorpay({
    key_id: env.RAZORPAY_KEY_ID!,
    key_secret: env.RAZORPAY_KEY_SECRET!,
  });
}

export function razorpayKeyId(): string {
  assertRazorpayConfigured();
  return env.RAZORPAY_KEY_ID!;
}

/** Verify Checkout success signature: order_id|payment_id */
export function verifyPaymentSignature(input: {
  orderId: string;
  paymentId: string;
  signature: string;
}): boolean {
  assertRazorpayConfigured();
  const body = `${input.orderId}|${input.paymentId}`;
  const expected = crypto
    .createHmac("sha256", env.RAZORPAY_KEY_SECRET!)
    .update(body)
    .digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(String(input.signature || ""), "utf8");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/** Amount for Razorpay Orders API is in paise. */
export function inrToPaise(amountInr: number): number {
  return Math.round(amountInr) * 100;
}
