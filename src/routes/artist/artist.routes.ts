import { Router } from "express";
import { z } from "zod";
import * as artistController from "../../controllers/artist.controller";
import { validate } from "../../utils/validate";

const router = Router();

const artistSignupSchema = z.object({
  email: z.email(),
  mobileNumber: z.string().regex(/^\d{10}$/, "Mobile number must be 10 digits"),
});

/**
 * @swagger
 * /artist-signup:
 *   post:
 *     tags: [Artist]
 *     summary: Create an artist account with email and mobile only (no password; verify OTP next)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/ArtistSignupRequest' }
 *     responses:
 *       201:
 *         description: Artist account created; call /verify-otp with the static OTP
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ArtistSignupResponse' }
 *       400:
 *         description: Invalid input
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       409:
 *         description: Email already registered
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.post("/artist-signup", validate(artistSignupSchema), artistController.signup);

export default router;
