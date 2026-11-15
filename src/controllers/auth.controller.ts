import type { Request, Response } from "express";
import * as authService from "../services/auth.service";
import { env } from "../config/env";
import { signToken } from "../lib/jwt";
import { ApiError } from "../utils/apiError";
import { assertCanSendOtp, markOtpSent, OTP_COOLDOWN_SECONDS } from "../utils/otpCooldown";
import { sendSuccess } from "../utils/response";
import { toPublicUser } from "../utils/user";

/** Request an OTP for login. Email OTP comes later; for now the static OTP is used. */
export async function login(req: Request, res: Response) {
  const email = String(req.body.email).trim().toLowerCase();

  const found = await authService.findUserByEmail(email);
  if (!found) throw new ApiError(404, "We couldn't find an account with this email");

  assertCanSendOtp(email);
  markOtpSent(email);

  sendSuccess(res, {
    message: "OTP sent. Enter the code to log in.",
    email: found.email,
    cooldownSeconds: OTP_COOLDOWN_SECONDS,
  });
}

/** Resend OTP after signup or login. Same static OTP for now; email delivery comes later. */
export async function resendOtp(req: Request, res: Response) {
  const email = String(req.body.email).trim().toLowerCase();

  const found = await authService.findUserByEmail(email);
  if (!found) throw new ApiError(404, "We couldn't find an account with this email");

  assertCanSendOtp(email);
  markOtpSent(email);

  sendSuccess(res, {
    message: "OTP resent. Enter the code to continue.",
    email: found.email,
    cooldownSeconds: OTP_COOLDOWN_SECONDS,
  });
}

export async function getMe(req: Request, res: Response) {
  const found = await authService.findUserWithProfileById(req.user!.id);
  if (!found) throw new ApiError(404, "User not found");

  const { customerProfile, artistProfile, ...user } = found;
  sendSuccess(res, {
    user: toPublicUser(user),
    profile: customerProfile ?? artistProfile,
  });
}

/**
 * Verify OTP for signup activation or login.
 * Activates the account on first success, then always returns a JWT.
 */
export async function verifyOtp(req: Request, res: Response) {
  const email = String(req.body.email).trim().toLowerCase();
  const { otp } = req.body as { otp: string };

  if (!env.STATIC_OTP_ENABLED) {
    throw new ApiError(503, "OTP verification by email is not available yet");
  }

  const found = await authService.findUserByEmail(email);
  if (!found || otp !== env.STATIC_OTP) throw new ApiError(400, "Invalid email or OTP");

  const user = toPublicUser(found.isActive ? found : await authService.activateUser(found.id));
  const token = signToken({ id: user.id, email: user.email, role: user.role });

  sendSuccess(res, { token, user });
}
