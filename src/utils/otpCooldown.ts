import { ApiError } from "./apiError";

/** Matches the frontend RESEND CODE timer in PatronGate. */
export const OTP_COOLDOWN_SECONDS = 60;

const lastSentAtByEmail = new Map<string, number>();

export function remainingCooldownSeconds(email: string): number {
  const lastSentAt = lastSentAtByEmail.get(email);
  if (lastSentAt == null) return 0;
  const elapsedMs = Date.now() - lastSentAt;
  const remainingMs = OTP_COOLDOWN_SECONDS * 1000 - elapsedMs;
  return remainingMs > 0 ? Math.ceil(remainingMs / 1000) : 0;
}

export function assertCanSendOtp(email: string) {
  const remaining = remainingCooldownSeconds(email);
  if (remaining > 0) {
    throw new ApiError(429, `Please wait ${remaining}s before requesting another code`);
  }
}

export function markOtpSent(email: string) {
  lastSentAtByEmail.set(email, Date.now());
}
