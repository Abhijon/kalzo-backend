import type { Request, Response } from "express";
import * as authService from "../services/auth.service";
import { env } from "../config/env";
import { signToken } from "../lib/jwt";
import { ApiError } from "../utils/apiError";
import { assertCanSendOtp, markOtpSent, OTP_COOLDOWN_SECONDS } from "../utils/otpCooldown";
import { sendSuccess } from "../utils/response";
import { toPublicUser } from "../utils/user";
import { prisma } from "../lib/prisma";
import { ROLES, type RoleName } from "../utils/roles";

const PORTAL_ROLES = [ROLES.CUSTOMER, ROLES.ARTIST] as const;

/**
 * Customer portal must only log in CUSTOMER accounts; artist portal only ARTIST.
 * Prevents cross-portal sign-in with the same email.
 */
function assertPortalRole(
  accountRole: string | undefined,
  requestedRaw: unknown,
) {
  const requested = String(requestedRaw ?? "")
    .trim()
    .toUpperCase() as RoleName;
  if (!(PORTAL_ROLES as readonly string[]).includes(requested)) {
    throw new ApiError(400, "role must be CUSTOMER or ARTIST");
  }

  const account = String(accountRole ?? "").toUpperCase();
  if (account === requested) return;

  if (account === ROLES.ARTIST) {
    throw new ApiError(
      403,
      "This email is not registered as an customer.",
    );
  }
  if (account === ROLES.CUSTOMER) {
    throw new ApiError(
      403,
      "This email is not registered as an artist.",
    );
  }
  throw new ApiError(403, "This account cannot log in here.");
}

/** Request an OTP for login. Email OTP comes later; for now the static OTP is used. */
export async function login(req: Request, res: Response) {
  const email = String(req.body.email).trim().toLowerCase();

  const found = await authService.findUserByEmail(email);
  if (!found) throw new ApiError(404, "We couldn't find an account with this email");

  assertPortalRole(found.role?.name, req.body.role);

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

  assertPortalRole(found.role?.name, req.body.role);

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

export async function updateMe(req: Request, res: Response) {
  const userId = req.user!.id;
  const user = await authService.findUserWithProfileById(userId);
  if (!user) throw new ApiError(404, "User not found");

  const role = user.role?.name;
  if (role === ROLES.CUSTOMER) {
    const { fullName, location, customerType, reasonForBooking, businessName, mobileNumber } = req.body;
    const data: Record<string, any> = {};
    if (typeof fullName === "string" && fullName.trim()) data.fullName = fullName.trim();
    if (typeof location === "string" && location.trim()) data.location = location.trim();
    if (typeof customerType === "string" && customerType.trim()) data.customerType = customerType.trim();
    if (typeof reasonForBooking === "string" && reasonForBooking.trim()) data.reasonForBooking = reasonForBooking.trim();
    if (typeof businessName === "string") data.businessName = businessName.trim();
    if (typeof mobileNumber === "string" && mobileNumber.trim()) data.mobileNumber = mobileNumber.trim();

    const updated = await prisma.customerProfile.upsert({
      where: { userId },
      create: {
        userId,
        fullName: data.fullName ?? "Patron",
        location: data.location ?? "",
        customerType: data.customerType ?? "Individual / family",
        reasonForBooking: data.reasonForBooking ?? "",
        businessName: data.businessName ?? null,
        mobileNumber: data.mobileNumber ?? "",
      },
      update: data,
    });

    sendSuccess(res, {
      message: "Profile updated successfully",
      profile: updated,
      user: toPublicUser(user),
    });
    return;
  }

  sendSuccess(res, {
    message: "Profile updated",
    profile: user.customerProfile ?? user.artistProfile,
    user: toPublicUser(user),
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

  // Security gate: refuse token if portal role does not match the account.
  assertPortalRole(found.role?.name, req.body.role);

  const user = toPublicUser(found.isActive ? found : await authService.activateUser(found.id));
  const token = signToken({ id: user.id, email: user.email, role: user.role });

  sendSuccess(res, { token, user });
}
