import type { Request, Response } from "express";
import * as authService from "../services/auth.service";
import * as customerService from "../services/customer.service";
import * as roleService from "../services/role.service";
import { ApiError } from "../utils/apiError";
import { markOtpSent, OTP_COOLDOWN_SECONDS } from "../utils/otpCooldown";
import { sendSuccess } from "../utils/response";
import { ROLES } from "../utils/roles";
import { toPublicUser } from "../utils/user";

type CustomerSignupBody = customerService.CustomerProfileInput & {
  email: string;
};

export async function signup(req: Request, res: Response) {
  const body = req.body as CustomerSignupBody;
  const email = body.email.trim().toLowerCase();

  const existing = await authService.findUserByEmail(email);
  if (existing) throw new ApiError(409, "Email is already registered");

  const role = await roleService.findRoleByName(ROLES.CUSTOMER);
  if (!role) throw new ApiError(500, "Customer role is missing from the roles table");

  const { customerProfile, ...created } = await customerService.createCustomer(email, role.id, {
    fullName: body.fullName,
    location: body.location,
    customerType: body.customerType,
    reasonForBooking: body.reasonForBooking,
    businessName: body.businessName,
    mobileNumber: body.mobileNumber,
  });

  markOtpSent(email);

  sendSuccess(
    res,
    {
      message: "Account created. Verify the OTP to activate it.",
      user: toPublicUser(created),
      profile: customerProfile,
      cooldownSeconds: OTP_COOLDOWN_SECONDS,
    },
    201,
  );
}
