import { Router } from "express";
import { z } from "zod";
import * as authController from "../../controllers/auth.controller";
import { authenticate } from "../../middleware/common.middleware";
import { validate } from "../../utils/validate";

const router = Router();

const loginSchema = z.object({
  email: z.email(),
});

const verifyOtpSchema = z.object({
  email: z.email(),
  otp: z.string().regex(/^\d{6}$/, "OTP must be 6 digits"),
});

/**
 * @swagger
 * /login:
 *   post:
 *     tags: [Auth]
 *     summary: Request a login OTP for an existing customer or artist (email only)
 *     description: No password. While STATIC_OTP_ENABLED is true, use the static OTP with /verify-otp. Real email OTP comes later.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email: { type: string, format: email }
 *     responses:
 *       200:
 *         description: OTP ready (static OTP for now)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     message: { type: string, example: "OTP sent. Enter the code to log in." }
 *                     email: { type: string, format: email }
 *       400:
 *         description: Invalid input
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       404:
 *         description: No account for this email
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.post("/login", validate(loginSchema), authController.login);

/**
 * @swagger
 * /resend-otp:
 *   post:
 *     tags: [Auth]
 *     summary: Resend the OTP after signup or login
 *     description: 60s cooldown between sends (same as the frontend RESEND timer). Static OTP for now.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email: { type: string, format: email }
 *     responses:
 *       200:
 *         description: OTP resent
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     message: { type: string }
 *                     email: { type: string, format: email }
 *                     cooldownSeconds: { type: integer, example: 60 }
 *       404:
 *         description: No account for this email
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       429:
 *         description: Cooldown still active
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.post("/resend-otp", validate(loginSchema), authController.resendOtp);

/**
 * @swagger
 * /verify-otp:
 *   post:
 *     tags: [Auth]
 *     summary: Verify OTP after signup or login and receive a JWT
 *     description: Uses the static OTP from the server environment while STATIC_OTP_ENABLED is true. Activates the account on first verify.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, otp]
 *             properties:
 *               email: { type: string, format: email }
 *               otp: { type: string, pattern: '^\d{4}$' }
 *     responses:
 *       200:
 *         description: Verified and logged in
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/AuthResponse' }
 *       400:
 *         description: Invalid email or OTP
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       503:
 *         description: Static OTP is disabled and email OTP is not available yet
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
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

export default router;
