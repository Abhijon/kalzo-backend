import type { Request, Response } from "express";
import * as artistService from "../services/artist.service";
import * as authService from "../services/auth.service";
import * as roleService from "../services/role.service";
import { ApiError } from "../utils/apiError";
import { markOtpSent, OTP_COOLDOWN_SECONDS } from "../utils/otpCooldown";
import { sendSuccess } from "../utils/response";
import { ROLES } from "../utils/roles";
import { toPublicUser } from "../utils/user";

type ArtistSignupBody = {
  email: string;
  mobileNumber: string;
};

export async function signup(req: Request, res: Response) {
  const body = req.body as ArtistSignupBody;
  const email = body.email.trim().toLowerCase();

  const existing = await authService.findUserByEmail(email);
  if (existing) throw new ApiError(409, "Email is already registered");

  const role = await roleService.findRoleByName(ROLES.ARTIST);
  if (!role) throw new ApiError(500, "Artist role is missing from the roles table");

  const { artistProfile, ...created } = await artistService.createArtist(email, role.id, {
    mobileNumber: body.mobileNumber,
  });

  markOtpSent(email);

  sendSuccess(
    res,
    {
      message: "Account created. Verify the OTP to activate it.",
      user: toPublicUser(created),
      profile: artistProfile,
      cooldownSeconds: OTP_COOLDOWN_SECONDS,
    },
    201,
  );
}
