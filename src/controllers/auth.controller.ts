import type { Request, Response } from "express";
import * as authService from "../services/auth.service";
import { env } from "../config/env";
import { signToken } from "../lib/jwt";
import { ApiError } from "../utils/apiError";
import { verifyPassword } from "../utils/password";
import { sendSuccess } from "../utils/response";
import { toPublicUser } from "../utils/user";

export async function login(req: Request, res: Response) {
  const email = String(req.body.email).trim().toLowerCase();
  const { password } = req.body as { password: string };

  const found = await authService.findUserByEmail(email);
  if (!found || !(await verifyPassword(password, found.passwordHash))) {
    throw new ApiError(401, "Invalid email or password");
  }
  if (!found.isActive) {
    throw new ApiError(403, "Account is not verified. Verify the OTP to activate it.");
  }

  const { passwordHash: _passwordHash, ...rest } = found;
  const user = toPublicUser(rest);
  const token = signToken({ sub: user.id, email: user.email, role: user.role });

  sendSuccess(res, { token, user });
}

export async function getMe(req: Request, res: Response) {
  const found = await authService.findUserWithProfileById(req.user!.id);
  if (!found) throw new ApiError(404, "User not found");

  const { customerProfile, ...user } = found;
  sendSuccess(res, { user: toPublicUser(user), profile: customerProfile });
}

export async function verifyOtp(req: Request, res: Response) {
  const email = String(req.body.email).trim().toLowerCase();
  const { otp } = req.body as { otp: string };

  if (!env.STATIC_OTP_ENABLED) {
    throw new ApiError(503, "OTP verification by email is not available yet");
  }

  const found = await authService.findUserByEmail(email);
  if (!found || otp !== env.STATIC_OTP) throw new ApiError(400, "Invalid email or OTP");
  if (found.isActive) throw new ApiError(409, "Account is already verified");

  const user = toPublicUser(await authService.activateUser(found.id));
  const token = signToken({ sub: user.id, email: user.email, role: user.role });

  sendSuccess(res, { token, user });
}
