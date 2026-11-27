import { Router } from "express";
import { z } from "zod";
import * as authController from "../../controllers/auth.controller";
import { authenticate } from "../../middleware/common.middleware";
import { validate } from "../../utils/validate";

const router = Router();

const portalRoleSchema = z.enum(["CUSTOMER", "ARTIST"]);

const loginSchema = z.object({
  email: z.email(),
  role: portalRoleSchema,
});

const verifyOtpSchema = z.object({
  email: z.email(),
  otp: z.string().regex(/^\d{6}$/, "OTP must be 6 digits"),
  role: portalRoleSchema,
});

/**
 * @swagger
 * /login:
 *   post:
 *     tags: [Auth]
 *     summary: Request a login OTP (role-gated portal)
 *     description: |
 *       No password. `role` must match the account (CUSTOMER vs ARTIST).
 *       Artists cannot log in from the client portal and vice versa.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, role]
 *             properties:
 *               email: { type: string, format: email }
 *               role: { type: string, enum: [CUSTOMER, ARTIST] }
 *     responses:
 *       200:
 *         description: OTP ready (static OTP for now)
 *       400:
 *         description: Invalid input
 *       403:
 *         description: Email belongs to the other portal role
 *       404:
 *         description: No account for this email
 */
router.post("/login", validate(loginSchema), authController.login);

/**
 * @swagger
 * /resend-otp:
 *   post:
 *     tags: [Auth]
 *     summary: Resend the OTP after signup or login
 *     description: Same role gate as /login. 60s cooldown between sends.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, role]
 *             properties:
 *               email: { type: string, format: email }
 *               role: { type: string, enum: [CUSTOMER, ARTIST] }
 *     responses:
 *       200:
 *         description: OTP resent
 *       403:
 *         description: Email belongs to the other portal role
 *       404:
 *         description: No account for this email
 *       429:
 *         description: Cooldown still active
 */
router.post("/resend-otp", validate(loginSchema), authController.resendOtp);

/**
 * @swagger
 * /verify-otp:
 *   post:
 *     tags: [Auth]
 *     summary: Verify OTP after signup or login and receive a JWT
 *     description: |
 *       Issues a JWT only when `role` matches the account.
 *       Uses the static OTP while STATIC_OTP_ENABLED is true.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, otp, role]
 *             properties:
 *               email: { type: string, format: email }
 *               otp: { type: string, pattern: '^\d{6}$' }
 *               role: { type: string, enum: [CUSTOMER, ARTIST] }
 *     responses:
 *       200:
 *         description: Verified and logged in
 *       400:
 *         description: Invalid email or OTP
 *       403:
 *         description: Email belongs to the other portal role
 *       503:
 *         description: Static OTP is disabled and email OTP is not available yet
 */
router.post("/verify-otp", validate(verifyOtpSchema), authController.verifyOtp);

/**
 * @swagger
 * /me:
 *   get:
 *     tags: [Auth]
 *     summary: Get the logged-in user and their profile
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current user; profile is customer or artist profile depending on role
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/MeResponse' }
 *       401:
 *         description: Missing, invalid or expired token
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       404:
 *         description: User no longer exists
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.get("/me", authenticate, authController.getMe);
router.patch("/me", authenticate, authController.updateMe);

export default router;
