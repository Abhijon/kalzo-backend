import { Router } from "express";
import { z } from "zod";
import * as artistController from "../../controllers/artist.controller";
import { authenticate, authorize } from "../../middleware/common.middleware";
import { uploadArtistProfile } from "../../middleware/multer.middleware";
import { ROLES } from "../../utils/roles";
import { validate } from "../../utils/validate";

const router = Router();

const artistSignupSchema = z.object({
  email: z.email(),
  mobileNumber: z.string().regex(/^\d{10}$/, "Mobile number must be 10 digits"),
});

const artistOnly = [authenticate, authorize(ROLES.ARTIST)] as const;

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
 *       400:
 *         description: Invalid input
 *       409:
 *         description: Email already registered
 */
router.post("/artist-signup", validate(artistSignupSchema), artistController.signup);

/**
 * @swagger
 * /artist/profile:
 *   get:
 *     tags: [Artist]
 *     summary: Get the logged-in artist's onboarding profile
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Artist profile
 *       401:
 *         description: Missing or invalid token
 *       403:
 *         description: Not an artist
 *       404:
 *         description: Profile not found
 */
router.get("/artist/profile", ...artistOnly, artistController.getProfile);

/**
 * @swagger
 * /artist/profile:
 *   post:
 *     tags: [Artist]
 *     summary: Submit artist profile for verification (single multipart form-data)
 *     description: |
 *       One request with all text fields plus files.
 *       Files: photo, artPhoto, faceVideo, reels (2–4).
 *       Arrays/objects as JSON strings: preferredCities, preferredStates, cityRates.
 *       Media is stored locally for now; path shape is S3-ready.
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - stageName
 *               - legalName
 *               - baseCity
 *               - stateName
 *               - currentCity
 *               - currentState
 *               - preferredCities
 *               - discipline
 *               - subcategory
 *               - bio
 *               - instagram
 *               - rateInr
 *               - photo
 *               - artPhoto
 *               - faceVideo
 *               - reels
 *             properties:
 *               stageName: { type: string }
 *               legalName: { type: string }
 *               baseCity: { type: string }
 *               stateName: { type: string }
 *               currentCity: { type: string }
 *               currentState: { type: string }
 *               preferredCities: { type: string, description: 'JSON array string e.g. ["Delhi","Mumbai"]' }
 *               preferredStates: { type: string, description: 'JSON array string' }
 *               discipline: { type: string }
 *               subcategory: { type: string }
 *               bio: { type: string }
 *               instagram: { type: string }
 *               rateInr: { type: integer }
 *               pricingUnit: { type: string, enum: [hour, event, plate] }
 *               travelSetting: { type: string, enum: [including, excluding, none] }
 *               travelChargeInr: { type: integer }
 *               stayChargeInr: { type: integer }
 *               cityRates: { type: string, description: 'JSON object string' }
 *               primaryReel: { type: integer }
 *               photo: { type: string, format: binary }
 *               artPhoto: { type: string, format: binary }
 *               faceVideo: { type: string, format: binary }
 *               reels: { type: array, items: { type: string, format: binary }, minItems: 2, maxItems: 4 }
 *     responses:
 *       200:
 *         description: Profile saved and submitted for verification
 *       400:
 *         description: Invalid fields or missing media
 *       401:
 *         description: Missing or invalid token
 *       403:
 *         description: Not an artist
 */
router.post("/artist/profile", ...artistOnly, uploadArtistProfile, artistController.saveProfile);

export default router;
