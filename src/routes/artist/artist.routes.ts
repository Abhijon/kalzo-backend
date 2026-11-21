import type { NextFunction, Request, Response } from "express";
import { Router } from "express";
import type { ZodType } from "zod";
import { z } from "zod";
import * as artistController from "../../controllers/artist.controller";
import { authenticate, authorize } from "../../middleware/common.middleware";
import { uploadArtistProfile } from "../../middleware/multer.middleware";
import { ApiError } from "../../utils/apiError";
import { ROLES } from "../../utils/roles";
import { validate } from "../../utils/validate";

const router = Router();

const artistSignupSchema = z.object({
  email: z.email(),
  mobileNumber: z.string().regex(/^\d{10}$/, "Mobile number must be 10 digits"),
});

const artistIdParam = z.object({
  id: z.uuid("Artist id must be a valid UUID"),
});

function validateParams(schema: ZodType) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.params);
    if (!result.success) {
      const issue = result.error.issues[0];
      throw new ApiError(400, issue?.message ?? "Invalid path params");
    }
    Object.assign(req.params, result.data);
    next();
  };
}

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
 *         description: Email already exists — use login or a different email
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
 *       Requires Digilocker KYC (`kycStatus=success`) first —
 *       POST /artist/kyc/digilocker/initiate then complete.
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
 *               - bankAccountHolder
 *               - bankName
 *               - bankAccountNumber
 *               - bankIfsc
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
 *               preferredCities: { type: string, description: 'Comma-separated or JSON array, e.g. Delhi NCR,Mumbai or ["Delhi NCR","Mumbai"]' }
 *               preferredStates: { type: string, description: 'Comma-separated or JSON array' }
 *               discipline: { type: string }
 *               subcategory: { type: string }
 *               bio: { type: string }
 *               instagram: { type: string }
 *               rateInr: { type: integer }
 *               pricingUnit: { type: string, enum: [hour, event, plate] }
 *               travelSetting: { type: string, enum: [including, excluding, none] }
 *               travelChargeInr: { type: integer }
 *               stayChargeInr: { type: integer }
 *               cityRates: { type: string, description: 'JSON object, e.g. {"Delhi":{"rate":25000,"travel":"not_needed","travel_charge":0,"stay_charge":0}}' }
 *               primaryReel: { type: integer }
 *               bankAccountHolder: { type: string }
 *               bankName: { type: string }
 *               bankAccountNumber: { type: string, description: '9–18 digits' }
 *               bankIfsc: { type: string, description: '11-char IFSC' }
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

/**
 * @swagger
 * /artists/verified:
 *   get:
 *     tags: [Artist]
 *     summary: List verified artists (paginated, flat response for customers)
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 100, default: 10 }
 *     responses:
 *       200:
 *         description: Verified artists only
 */
router.get("/artists/verified", artistController.listVerifiedArtists);

/**
 * @swagger
 * /artists/{id}:
 *   get:
 *     tags: [Artist]
 *     summary: Get one verified artist by id (public, no auth)
 *     description: Returns public artist details with media URLs, including live face video. Bank and KYC PII are omitted.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Artist detail
 *       400:
 *         description: Invalid artist id
 *       404:
 *         description: Artist not found or not verified
 */
router.get("/artists/:id", validateParams(artistIdParam), artistController.getArtistById);

export default router;
