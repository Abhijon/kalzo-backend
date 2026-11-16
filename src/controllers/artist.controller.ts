import type { Request, Response } from "express";
import { z } from "zod";
import * as artistService from "../services/artist.service";
import * as authService from "../services/auth.service";
import * as mediaService from "../services/media.service";
import * as roleService from "../services/role.service";
import { ApiError } from "../utils/apiError";
import { markOtpSent, OTP_COOLDOWN_SECONDS } from "../utils/otpCooldown";
import { sendSuccess } from "../utils/response";
import { ROLES } from "../utils/roles";
import { toPublicUser } from "../utils/user";

type ArtistSignupBody = {
  email: string;
  mobileNumber: string;
};

type MulterFiles = {
  photo?: Express.Multer.File[];
  artPhoto?: Express.Multer.File[];
  faceVideo?: Express.Multer.File[];
  reels?: Express.Multer.File[];
};

const cityRateSchema = z.object({
  rate: z.number().int().min(1).max(100000),
  travel: z.enum(["included", "separate", "not_needed"]),
  travel_charge: z.number().int().min(0).max(500000).default(0),
  stay_charge: z.number().int().min(0).max(500000).default(0),
});

/** Multipart fields arrive as strings; coerce numbers / JSON arrays here. */
const profileFormSchema = z.object({
  stageName: z.string().trim().min(1).max(100),
  legalName: z.string().trim().min(2).max(100),
  baseCity: z.string().trim().min(1).max(100),
  stateName: z.string().trim().min(1).max(100),
  currentCity: z.string().trim().min(1).max(100),
  currentState: z.string().trim().min(1).max(100),
  preferredCities: z.array(z.string().trim().min(1).max(100)).min(1).max(20),
  preferredStates: z.array(z.string().trim().min(1).max(100)).max(20).default([]),
  discipline: z.string().trim().min(1).max(100),
  subcategory: z.string().trim().min(1).max(100),
  bio: z.string().trim().min(1).max(2000),
  instagram: z
    .string()
    .trim()
    .max(200)
    .refine(
      (v) => /^https:\/\/(www\.)?instagram\.com\/[A-Za-z0-9_.]+\/?$/.test(v),
      "Use your Instagram profile URL",
    ),
  rateInr: z.coerce.number().int().min(1).max(100000),
  pricingUnit: z.enum(["hour", "event", "plate"]).default("hour"),
  travelSetting: z.enum(["including", "excluding", "none"]).default("including"),
  travelChargeInr: z.coerce.number().int().min(0).max(500000).default(0),
  stayChargeInr: z.coerce.number().int().min(0).max(500000).default(0),
  cityRates: z.record(z.string().max(100), cityRateSchema).default({}),
  primaryReel: z.coerce.number().int().min(0).max(3).default(0),
});

function parseJsonField<T>(raw: unknown, field: string, fallback: T): T {
  if (raw == null || raw === "") return fallback;
  if (typeof raw !== "string") return raw as T;
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new ApiError(400, `${field} must be valid JSON`);
  }
}

export async function signup(req: Request, res: Response) {
  const body = req.body as ArtistSignupBody;
  const email = body.email.trim().toLowerCase();

  const existing = await authService.findUserByEmail(email);
  if (existing) throw new ApiError(409, "Email is already registered");

  const role = await roleService.findRoleByName(ROLES.ARTIST);
  if (!role) throw new ApiError(500, "Artist role is missing from the roles table");

  const { artistProfile, ...created } = await artistService.createArtist(email, role.id, {
    mobileNumber: body.mobileNumber,
  });

  markOtpSent(email);

  sendSuccess(
    res,
    {
      message: "Account created. Verify the OTP to activate it.",
      user: toPublicUser(created),
      profile: artistProfile,
      cooldownSeconds: OTP_COOLDOWN_SECONDS,
    },
    201,
  );
}

async function requireArtistProfile(userId: string) {
  const profile = await artistService.findProfileByUserId(userId);
  if (!profile) throw new ApiError(404, "Artist profile not found");
  return profile;
}

/** GET /artist/profile */
export async function getProfile(req: Request, res: Response) {
  const profile = await requireArtistProfile(req.user!.id);
  sendSuccess(res, { profile });
}

/**
 * POST /artist/profile — one multipart form-data submit.
 * Fields: profile text + photo, artPhoto, faceVideo, reels (2–4).
 */
export async function saveProfile(req: Request, res: Response) {
  await requireArtistProfile(req.user!.id);
  const userId = req.user!.id;
  const files = (req.files ?? {}) as MulterFiles;

  const photo = files.photo?.[0];
  const artPhoto = files.artPhoto?.[0];
  const faceVideo = files.faceVideo?.[0];
  const reelFiles = files.reels ?? [];

  if (!photo) throw new ApiError(400, "photo is required");
  if (!artPhoto) throw new ApiError(400, "artPhoto is required");
  if (!faceVideo) throw new ApiError(400, "faceVideo is required");
  if (reelFiles.length < 2) throw new ApiError(400, "At least 2 reels are required");
  if (reelFiles.length > 4) throw new ApiError(400, "At most 4 reels are allowed");

  const parsed = profileFormSchema.safeParse({
    ...req.body,
    preferredCities: parseJsonField(req.body.preferredCities, "preferredCities", []),
    preferredStates: parseJsonField(req.body.preferredStates, "preferredStates", []),
    cityRates: parseJsonField(req.body.cityRates, "cityRates", {}),
  });

  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new ApiError(400, issue?.message ?? "Invalid profile fields");
  }

  const data = parsed.data;
  if (data.primaryReel >= reelFiles.length) {
    throw new ApiError(400, "Choose an uploaded primary reel");
  }

  const [photoSaved, artSaved, faceSaved, ...reelSaved] = await Promise.all([
    mediaService.saveArtistMedia(userId, photo),
    mediaService.saveArtistMedia(userId, artPhoto),
    mediaService.saveArtistMedia(userId, faceVideo),
    ...reelFiles.map((f) => mediaService.saveArtistMedia(userId, f)),
  ]);

  await artistService.updateProfileByUserId(userId, {
    ...data,
    travelChargeInr: data.travelSetting === "excluding" ? data.travelChargeInr : 0,
    stayChargeInr: data.travelSetting === "excluding" ? data.stayChargeInr : 0,
    photoPath: photoSaved.path,
    artPhotoPath: artSaved.path,
    faceVideoPath: faceSaved.path,
    reels: reelSaved.map((r) => r.path),
  });

  const profile = await artistService.submitProfileByUserId(userId);
  sendSuccess(res, {
    message: "Profile submitted for verification.",
    profile,
  });
}
