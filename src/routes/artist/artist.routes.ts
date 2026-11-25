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
 *     summary: Submit artist profile for verification
 *     description: |
 *       Requires Digilocker KYC (`kycStatus=success`) first.
 *       Preferred: upload media via POST /media/uploads (presigned S3), then
 *       send application/json with photoPath, artPhotoPath, faceVideoPath, reels[].
 *       Legacy: multipart/form-data with binary files still works.
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
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
 *               - photoPath
 *               - artPhotoPath
 *               - faceVideoPath
 *               - reels
 *             properties:
 *               stageName: { type: string }
 *               legalName: { type: string }
 *               baseCity: { type: string }
 *               stateName: { type: string }
 *               currentCity: { type: string }
 *               currentState: { type: string }
 *               preferredCities:
 *                 type: array
 *                 items: { type: string }
 *               preferredStates:
 *                 type: array
 *                 items: { type: string }
 *               discipline: { type: string }
 *               subcategory: { type: string }
 *               bio: { type: string }
 *               instagram: { type: string }
 *               rateInr: { type: integer }
 *               pricingUnit: { type: string, enum: [hour, event, plate] }
 *               travelSetting: { type: string, enum: [including, excluding, none] }
 *               travelChargeInr: { type: integer }
 *               stayChargeInr: { type: integer }
 *               cityRates: { type: object }
 *               primaryReel: { type: integer }
 *               bankAccountHolder: { type: string }
 *               bankName: { type: string }
 *               bankAccountNumber: { type: string }
 *               bankIfsc: { type: string }
 *               photoPath: { type: string, description: S3 key from /media/uploads }
 *               artPhotoPath: { type: string }
 *               faceVideoPath: { type: string }
 *               reels:
 *                 type: array
 *                 items: { type: string }
 *                 minItems: 2
 *                 maxItems: 4
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             description: Legacy file upload path
 *             properties:
 *               photo: { type: string, format: binary }
 *               artPhoto: { type: string, format: binary }
 *               faceVideo: { type: string, format: binary }
 *               reels: { type: array, items: { type: string, format: binary } }
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
 * /artist/profile:
 *   patch:
 *     tags: [Artist]
 *     summary: Update an existing artist profile
 *     description: |
 *       Partial update for bio, pricing, locations, travel settings, and media.
 *       All fields are optional. Media keys must be presigned S3 keys from /media/uploads.
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               stageName: { type: string }
 *               legalName: { type: string }
 *               baseCity: { type: string }
 *               stateName: { type: string }
 *               currentCity: { type: string }
 *               currentState: { type: string }
 *               preferredCities:
 *                 type: array
 *                 items: { type: string }
 *               preferredStates:
 *                 type: array
 *                 items: { type: string }
 *               discipline: { type: string }
 *               subcategory: { type: string }
 *               bio: { type: string }
 *               instagram: { type: string }
 *               rateInr: { type: integer }
 *               pricingUnit: { type: string, enum: [hour, event, plate] }
 *               travelSetting: { type: string, enum: [including, excluding, none] }
 *               travelChargeInr: { type: integer }
 *               stayChargeInr: { type: integer }
 *               cityRates: { type: object }
 *               primaryReel: { type: integer }
 *               bankAccountHolder: { type: string }
 *               bankName: { type: string }
 *               bankAccountNumber: { type: string }
 *               bankIfsc: { type: string }
 *               photoPath: { type: string, description: S3 key }
 *               artPhotoPath: { type: string, description: S3 key }
 *               faceVideoPath: { type: string, description: S3 key }
 *               reels:
 *                 type: array
 *                 items: { type: string }
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *       400:
 *         description: Invalid fields or media keys
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Profile not found
 */
router.patch("/artist/profile", ...artistOnly, artistController.updateProfile);

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
 *       - in: query
 *         name: discipline
 *         schema: { type: string, example: Musicians }
 *         description: Art form type
 *       - in: query
 *         name: subcategory
 *         schema: { type: string, example: Guitarist }
 *       - in: query
 *         name: city
 *         schema: { type: string, example: Mumbai }
 *         description: City to match (see tier). Prefer city over state when both are sent.
 *       - in: query
 *         name: state
 *         schema: { type: string, example: Rajasthan }
 *         description: State to match when city is omitted (see tier)
 *       - in: query
 *         name: tier
 *         schema:
 *           type: string
 *           enum: [all, current, base, preferred]
 *           default: all
 *         description: |
 *           Narrow city/state match.
 *           all = current + base + preferred;
 *           current = currentCity / currentState;
 *           base = baseCity / stateName;
 *           preferred = preferredCities / preferredStates.
 *           Aliases: visiting→current, pref→preferred.
 *       - in: query
 *         name: maxRate
 *         schema: { type: integer, example: 25000 }
 *         description: Maximum rateInr
 *       - in: query
 *         name: date
 *         schema: { type: string, format: date, example: "2026-11-24" }
 *         description: Only artists whose recurring weekday for this date is active
 *       - in: query
 *         name: weekday
 *         schema: { type: integer, minimum: 0, maximum: 6, example: 1 }
 *         description: 0=Sunday … 6=Saturday (or use day=monday)
 *       - in: query
 *         name: day
 *         schema: { type: string, example: monday }
 *     responses:
 *       200:
 *         description: Verified artists only
 *       400:
 *         description: Invalid date/weekday/tier filter
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
