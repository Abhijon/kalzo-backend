import { randomInt } from "crypto";
import { env } from "../config/env";

/** Six-digit booking OTP. */
export function newBookingCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export function newBookingCodes() {
  const arrival = newBookingCode();
  let closing = newBookingCode();
  while (closing === arrival) closing = newBookingCode();
  return { arrival, closing };
}

export function normalizeOtp(raw: unknown): string {
  return String(raw ?? "").replace(/\D/g, "").slice(0, 6);
}

export function isBookingOtp(code: string): boolean {
  return /^\d{6}$/.test(code);
}

/**
 * When STATIC_OTP_ENABLED (same as login), arrival/closing verification
 * and patron reveal use STATIC_OTP instead of the per-booking codes.
 */
export function expectedBookingOtp(stored: string | null | undefined): string | null {
  if (env.STATIC_OTP_ENABLED && env.STATIC_OTP) return env.STATIC_OTP;
  return stored ?? null;
}

export function matchesBookingOtp(
  submitted: string,
  stored: string | null | undefined,
): boolean {
  const expected = expectedBookingOtp(stored);
  return Boolean(expected && submitted === expected);
}

/** @deprecated use isBookingOtp */
export function isFourDigitOtp(code: string): boolean {
  return isBookingOtp(code);
}
