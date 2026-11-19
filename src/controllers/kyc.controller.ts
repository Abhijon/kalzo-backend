import type { Request, Response } from "express";
import { z } from "zod";
import * as kycService from "../services/kyc.service";
import { toFlatArtist } from "../utils/artistResponse";
import { ApiError } from "../utils/apiError";
import { sendSuccess } from "../utils/response";

const completeSchema = z.object({
  clientId: z.string().trim().min(1),
});

const webhookSchema = z.object({
  client_id: z.string().trim().min(1),
  status: z.string().trim().optional(),
  type: z.string().trim().optional(),
});

/** POST /artist/kyc/digilocker/initiate — start Digilocker Via Link session */
export async function initiateDigilocker(req: Request, res: Response) {
  const { profile, session } = await kycService.initiateDigilocker(req.user!.id);
  sendSuccess(res, {
    message: "Digilocker KYC session created. Open the URL or pass token to Digiboost SDK.",
    session,
    profile: toFlatArtist(profile),
  });
}

/** GET /artist/kyc/status */
export async function getStatus(req: Request, res: Response) {
  const kyc = await kycService.getKycStatus(req.user!.id);
  sendSuccess(res, { kyc });
}

/**
 * POST /artist/kyc/digilocker/complete
 * Call after frontend Digilocker success (or after redirect) with client_id.
 */
export async function completeDigilocker(req: Request, res: Response) {
  const parsed = completeSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, "clientId is required");

  const profile = await kycService.completeKyc(parsed.data.clientId, {
    userId: req.user!.id,
  });
  sendSuccess(res, {
    message: "KYC completed.",
    profile: toFlatArtist(profile),
  });
}

/** POST /webhooks/surepass — Surepass Digilocker status callback (public) */
export async function surepassWebhook(req: Request, res: Response) {
  const parsed = webhookSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, "Invalid webhook payload");

  const profile = await kycService.handleSurepassWebhook(parsed.data);
  sendSuccess(res, {
    message: "Webhook processed.",
    profile: profile ? toFlatArtist(profile) : null,
  });
}
