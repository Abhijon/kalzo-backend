import { Router } from "express";
import { z } from "zod";
import * as authController from "../../controllers/auth.controller";
import { authenticate } from "../../middleware/common.middleware";
import { validate } from "../../utils/validate";

const router = Router();

const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1, "Password is required"),
});

const verifyOtpSchema = z.object({
  email: z.email(),
  otp: z.string().regex(/^\d{4}$/, "OTP must be 4 digits"),
});

/**
 * @swagger
 * /login:
 *   post:
 *     tags: [Auth]
 *     summary: Log in as a customer or artist with email and password
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string, format: email }
 *               password: { type: string, format: password }
 *     responses:
 *       200:
 *         description: Logged in; user.role tells the client which app area to open
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/AuthResponse' }
 *       400:
 *         description: Invalid input
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       401:
 *         description: Invalid email or password
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       403:
 *         description: Account not verified yet (isActive is false)
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.post("/login", validate(loginSchema), authController.login);

/**
 * @swagger
 * /verify-otp:
 *   post:
 *     tags: [Auth]
 *     summary: Verify the signup OTP, activate the account (isActive = true) and receive a JWT
 *     description: Uses the static OTP from the server environment while STATIC_OTP_ENABLED is true.
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
 *         description: Account verified and logged in
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/AuthResponse' }
 *       400:
 *         description: Invalid email or OTP
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       409:
 *         description: Account is already verified
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
 *         description: Current user; profile is the customer profile for customers, null otherwise
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
