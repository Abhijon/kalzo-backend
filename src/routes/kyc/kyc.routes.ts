import { Router } from "express";
import { z } from "zod";
import * as kycController from "../../controllers/kyc.controller";
import { authenticate, authorize } from "../../middleware/common.middleware";
import { ROLES } from "../../utils/roles";
import { validate } from "../../utils/validate";

const router = Router();

const artistOnly = [authenticate, authorize(ROLES.ARTIST)] as const;

const completeSchema = z.object({
  clientId: z.string().trim().min(1),
});

/**
 * @swagger
 * /artist/kyc/digilocker/initiate:
 *   post:
 *     tags: [KYC]
 *     summary: Start Surepass Digilocker Via Link KYC for the logged-in artist
 *     description: |
 *       Calls Surepass `POST /api/v1/digilocker/initialize`.
 *       Returns `session.url` (open in browser / WebView) and/or `session.token` (Digiboost SDK).
 *       Pass a publicly reachable `PUBLIC_API_URL` / `SUREPASS_WEBHOOK_URL` so Surepass can notify completion.
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Digilocker session created
 *       400:
 *         description: KYC already completed
 *       503:
 *         description: Surepass not configured
 */
router.post(
  "/artist/kyc/digilocker/initiate",
  ...artistOnly,
  kycController.initiateDigilocker,
);

/**
 * @swagger
 * /artist/kyc/status:
 *   get:
 *     tags: [KYC]
 *     summary: Get Digilocker KYC status for the logged-in artist
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: KYC status
 */
router.get("/artist/kyc/status", ...artistOnly, kycController.getStatus);

/**
 * @swagger
 * /artist/kyc/digilocker/complete:
 *   post:
 *     tags: [KYC]
 *     summary: Finalize Digilocker KYC after client success (downloads Aadhaar from Surepass)
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [clientId]
 *             properties:
 *               clientId: { type: string, description: client_id from Digilocker success / initiate }
 *     responses:
 *       200:
 *         description: KYC completed and Aadhaar details stored
 */
router.post(
  "/artist/kyc/digilocker/complete",
  ...artistOnly,
  validate(completeSchema),
  kycController.completeDigilocker,
);

/**
 * @swagger
 * /webhooks/surepass:
 *   post:
 *     tags: [KYC]
 *     summary: Surepass Digilocker webhook (public)
 *     description: |
 *       Payload example: `{ "client_id": "digilocker_...", "status": "success", "type": "digilocker" }`
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [client_id]
 *             properties:
 *               client_id: { type: string }
 *               status: { type: string }
 *               type: { type: string }
 *     responses:
 *       200:
 *         description: Webhook processed
 */
router.post("/webhooks/surepass", kycController.surepassWebhook);

export default router;
