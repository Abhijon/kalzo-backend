import type { Request, Response } from "express";
import { z } from "zod";
import * as artistService from "../services/artist.service";
import * as authService from "../services/auth.service";
import * as availabilityService from "../services/availability.service";
import * as mediaService from "../services/media.service";
import * as roleService from "../services/role.service";
import { toFlatArtist, toPublicArtist, toPublicArtistDetail } from "../utils/artistResponse";
import { ApiError } from "../utils/apiError";
import { markOtpSent, OTP_COOLDOWN_SECONDS } from "../utils/otpCooldown";
import { paginationMeta, parsePagination } from "../utils/pagination";
import { sendSuccess } from "../utils/response";
import { ROLES } from "../utils/roles";
import { toPublicUser } from "../utils/user";
import { assertKycCompleted } from "../utils/kyc";
import { VERIFICATION_STATUS } from "../utils/verification";

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
  bankAccountHolder: z.string().trim().min(2).max(100),
  bankName: z.string().trim().min(2).max(100),
  bankAccountNumber: z
    .string()
    .trim()
    .regex(/^\d{9,18}$/, "Account number must be 9–18 digits"),
  bankIfsc: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, "Enter a valid IFSC code"),
});

/** Schema for partial updates to an existing artist profile. */
const profileUpdateSchema = z.object({
  stageName: z.string().trim().min(1).max(100).optional(),
  legalName: z.string().trim().min(2).max(100).optional(),
  baseCity: z.string().trim().min(1).max(100).optional(),
  stateName: z.string().trim().min(1).max(100).optional(),
  currentCity: z.string().trim().min(1).max(100).optional(),
  currentState: z.string().trim().min(1).max(100).optional(),
  preferredCities: z.array(z.string().trim().min(1).max(100)).max(20).optional(),
  preferredStates: z.array(z.string().trim().min(1).max(100)).max(20).optional(),
  discipline: z.string().trim().min(1).max(100).optional(),
  subcategory: z.string().trim().min(1).max(100).optional(),
  bio: z.string().trim().min(1).max(2000).optional(),
  instagram: z
    .string()
    .trim()
    .max(200)
    .refine(
      (v) => !v || /^https:\/\/(www\.)?instagram\.com\/[A-Za-z0-9_.]+\/?$/.test(v),
      "Use your Instagram profile URL",
    )
    .optional(),
  rateInr: z.coerce.number().int().min(1).max(100000).optional(),
  pricingUnit: z.enum(["hour", "event", "plate"]).optional(),
  travelSetting: z.enum(["including", "excluding", "none"]).optional(),
  travelChargeInr: z.coerce.number().int().min(0).max(500000).optional(),
  stayChargeInr: z.coerce.number().int().min(0).max(500000).optional(),
  cityRates: z.record(z.string().max(100), cityRateSchema).optional(),
  primaryReel: z.coerce.number().int().min(0).max(3).optional(),
  bankAccountHolder: z.string().trim().min(2).max(100).optional(),
  bankName: z.string().trim().min(2).max(100).optional(),
  bankAccountNumber: z
    .string()
    .trim()
    .regex(/^\d{9,18}$/, "Account number must be 9–18 digits")
    .optional(),
  bankIfsc: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, "Enter a valid IFSC code")
    .optional(),
  photoPath: z.string().trim().nullable().optional(),
  artPhotoPath: z.string().trim().nullable().optional(),
  faceVideoPath: z.string().trim().nullable().optional(),
  reels: z.array(z.string().trim()).min(2).max(4).optional(),
});

/** Swagger/multipart sometimes uses curly quotes. */
function normalizeFormText(raw: string): string {
  return raw
    .trim()
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2018\u2019]/g, "'");
}

/**
 * Accepts:
 * - array already
 * - JSON array string: ["Delhi NCR","Mumbai"]
 * - comma-separated: Delhi NCR,Mumbai,Jaipur
 */
function parseStringList(raw: unknown, field: string, fallback: string[] = []): string[] {
  if (raw == null || raw === "") return fallback;
  if (Array.isArray(raw)) {
    return raw.map((v) => String(v).trim()).filter(Boolean);
  }

  let text = normalizeFormText(String(raw));
  // Unwrap accidental double-encoding: "\"[\\\"a\\\"]\"" or "\"[\"a\"]\""
  if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) {
    try {
      const unwrapped = JSON.parse(text);
      if (typeof unwrapped === "string") text = unwrapped.trim();
      else if (Array.isArray(unwrapped)) {
        return unwrapped.map((v) => String(v).trim()).filter(Boolean);
      }
    } catch {
      text = text.slice(1, -1).trim();
    }
  }

  if (text.startsWith("[")) {
    try {
      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed)) throw new Error("not array");
      return parsed.map((v) => String(v).trim()).filter(Boolean);
    } catch {
      throw new ApiError(400, `${field} must be a JSON array or comma-separated list`);
    }
  }

  return text
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

/** Accepts JSON object string, empty, or already-parsed object. */
function parseCityRates(raw: unknown): Record<string, unknown> {
  if (raw == null || raw === "") return {};
  if (typeof raw === "object" && !Array.isArray(raw)) return raw as Record<string, unknown>;

  let text = normalizeFormText(String(raw));
  if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) {
    try {
      const unwrapped = JSON.parse(text);
      if (typeof unwrapped === "string") text = unwrapped.trim();
      else if (typeof unwrapped === "object" && unwrapped && !Array.isArray(unwrapped)) {
        return unwrapped as Record<string, unknown>;
      }
    } catch {
      text = text.slice(1, -1).trim();
    }
  }

  if (!text || text === "{}") return {};
  try {
    const parsed = JSON.parse(text);
    if (typeof parsed !== "object" || parsed == null || Array.isArray(parsed)) {
      throw new Error("not object");
    }
    return parsed as Record<string, unknown>;
  } catch {
    throw new ApiError(400, 'cityRates must be a JSON object e.g. {"Delhi":{"rate":25000,"travel":"not_needed"}}');
  }
}

export async function signup(req: Request, res: Response) {
  const body = req.body as ArtistSignupBody;
  const email = body.email.trim().toLowerCase();

  const existing = await authService.findUserByEmail(email);
  if (existing) {
    throw new ApiError(
      409,
      "An account with this email already exists. Please log in, or use a different email to sign up.",
    );
  }

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
  return artistService.ensureProfileByUserId(userId);
}

/** GET /artist/profile — same flat shape as admin get-by-id (submitted POST data). */
export async function getProfile(req: Request, res: Response) {
  const profile = await requireArtistProfile(req.user!.id);
  sendSuccess(res, { profile: toFlatArtist(profile) });
}

/** GET /artists/verified — filters: discipline, city, maxRate, date (maps to recurring weekday) */
export async function listVerifiedArtists(req: Request, res: Response) {
  const q = parsePagination(req.query);
  const discipline = req.query.discipline ? String(req.query.discipline).trim() : undefined;
  const subcategory = req.query.subcategory ? String(req.query.subcategory).trim() : undefined;
  const city = req.query.city ? String(req.query.city).trim() : undefined;
  const maxRateRaw = req.query.maxRate != null ? Number(req.query.maxRate) : undefined;
  const maxRate =
    maxRateRaw != null && Number.isFinite(maxRateRaw) && maxRateRaw > 0
      ? Math.floor(maxRateRaw)
      : undefined;
  const dateStr = req.query.date ? String(req.query.date).trim() : undefined;
  let date: Date | undefined;
  if (dateStr) {
    const parsed = availabilityService.parseDateOnly(dateStr);
    if (!parsed) throw new ApiError(400, "date must be YYYY-MM-DD");
    date = parsed;
  }
  const weekdayRaw = req.query.weekday ?? req.query.day;
  const weekday =
    weekdayRaw != null ? availabilityService.parseWeekday(weekdayRaw) : undefined;
  if (weekdayRaw != null && weekday == null) {
    throw new ApiError(400, 'weekday must be 0–6 or a day name like "monday"');
  }

  const { artists, totalCount } = await artistService.listProfiles({
    limit: q.limit,
    offset: q.offset,
    verificationStatus: VERIFICATION_STATUS.VERIFIED,
    discipline,
    subcategory,
    city,
    maxRate,
    date,
    weekday: weekday ?? undefined,
  });

  sendSuccess(res, {
    artists: artists.map(toPublicArtist),
    pagination: paginationMeta(totalCount, q),
  });
}

/** GET /artists/:id — public artist detail (verified only; includes live face video). */
export async function getArtistById(req: Request, res: Response) {
  const artist = await artistService.findProfileById(String(req.params.id));
  if (!artist || artist.verificationStatus !== VERIFICATION_STATUS.VERIFIED) {
    throw new ApiError(404, "Artist not found");
  }

  sendSuccess(res, { artist: toPublicArtistDetail(artist) });
}

/**
 * POST /artist/profile — text + media.
 * Preferred: JSON with S3 keys from /media/uploads (direct upload).
 * Legacy: multipart form-data with files (still supported).
 */
export async function saveProfile(req: Request, res: Response) {
  const existing = await requireArtistProfile(req.user!.id);
  assertKycCompleted(existing.kycStatus);
  const userId = req.user!.id;
  const files = (req.files ?? {}) as MulterFiles;

  const photo = files.photo?.[0];
  const artPhoto = files.artPhoto?.[0];
  const faceVideo = files.faceVideo?.[0];
  const reelFiles = files.reels ?? [];
  const hasMultipartFiles = Boolean(photo && artPhoto && faceVideo && reelFiles.length >= 2);

  const parsed = profileFormSchema.safeParse({
    ...req.body,
    preferredCities: parseStringList(req.body.preferredCities, "preferredCities"),
    preferredStates: parseStringList(req.body.preferredStates, "preferredStates", []),
    cityRates: parseCityRates(req.body.cityRates),
  });

  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new ApiError(400, issue?.message ?? "Invalid profile fields");
  }

  const data = parsed.data;

  let photoPath: string;
  let artPhotoPath: string;
  let faceVideoPath: string;
  let reels: string[];

  if (hasMultipartFiles) {
    if (reelFiles.length > 4) throw new ApiError(400, "At most 4 reels are allowed");
    if (data.primaryReel >= reelFiles.length) {
      throw new ApiError(400, "Choose an uploaded primary reel");
    }
    const [photoSaved, artSaved, faceSaved, ...reelSaved] = await Promise.all([
      mediaService.saveArtistMedia(userId, photo!),
      mediaService.saveArtistMedia(userId, artPhoto!),
      mediaService.saveArtistMedia(userId, faceVideo!),
      ...reelFiles.map((f) => mediaService.saveArtistMedia(userId, f)),
    ]);
    photoPath = photoSaved.path;
    artPhotoPath = artSaved.path;
    faceVideoPath = faceSaved.path;
    reels = reelSaved.map((r) => r.path);
  } else {
    const keyPhoto = String(req.body.photoPath ?? "").trim();
    const keyArt = String(req.body.artPhotoPath ?? "").trim();
    const keyFace = String(req.body.faceVideoPath ?? "").trim();
    const rawReels = req.body.reels;
    const keyReels = Array.isArray(rawReels)
      ? rawReels.map((k) => String(k).trim()).filter(Boolean)
      : parseStringList(rawReels, "reels", []);

    if (!keyPhoto) throw new ApiError(400, "photoPath is required (upload media first)");
    if (!keyArt) throw new ApiError(400, "artPhotoPath is required (upload media first)");
    if (!keyFace) throw new ApiError(400, "faceVideoPath is required (upload media first)");
    if (keyReels.length < 2) throw new ApiError(400, "At least 2 reel keys are required");
    if (keyReels.length > 4) throw new ApiError(400, "At most 4 reels are allowed");
    if (data.primaryReel >= keyReels.length) {
      throw new ApiError(400, "Choose an uploaded primary reel");
    }

    const verified = await mediaService.assertOwnedMediaKeysExist(userId, [
      keyPhoto,
      keyArt,
      keyFace,
      ...keyReels,
    ]);
    photoPath = verified[0]!;
    artPhotoPath = verified[1]!;
    faceVideoPath = verified[2]!;
    reels = verified.slice(3);
  }

  const previousKeys = [
    existing.photoPath,
    existing.artPhotoPath,
    existing.faceVideoPath,
    ...(existing.reels ?? []),
  ];

  await artistService.updateProfileByUserId(userId, {
    ...data,
    travelChargeInr: data.travelSetting === "excluding" ? data.travelChargeInr : 0,
    stayChargeInr: data.travelSetting === "excluding" ? data.stayChargeInr : 0,
    photoPath,
    artPhotoPath,
    faceVideoPath,
    reels,
  });

  // Best-effort: remove previous S3 objects after DB update succeeds
  await mediaService.deleteMediaMany(previousKeys);

  await artistService.submitProfileByUserId(userId);
  const profile = await artistService.findProfileByUserId(userId);
  if (!profile) throw new ApiError(404, "Artist profile not found");
  sendSuccess(res, {
    message: "Profile submitted for admin verification.",
    profile: toFlatArtist(profile),
  });
}

/**
 * PATCH /artist/profile — partial update to an existing profile.
 * Allows updating bio, pricing, locations, travel settings, and media.
 */
export async function updateProfile(req: Request, res: Response) {
  const userId = req.user!.id;
  const existing = await requireArtistProfile(userId);
  if (!existing) {
    throw new ApiError(404, "Artist profile not found");
  }

  // Pre-process fields if present
  const rawBody: Record<string, unknown> = { ...req.body };
  if ("preferredCities" in req.body && req.body.preferredCities !== undefined) {
    rawBody.preferredCities = parseStringList(req.body.preferredCities, "preferredCities");
  }
  if ("preferredStates" in req.body && req.body.preferredStates !== undefined) {
    rawBody.preferredStates = parseStringList(req.body.preferredStates, "preferredStates", []);
  }
  if ("cityRates" in req.body && req.body.cityRates !== undefined) {
    rawBody.cityRates = parseCityRates(req.body.cityRates);
  }
  if ("reels" in req.body && req.body.reels !== undefined) {
    rawBody.reels = Array.isArray(req.body.reels)
      ? (req.body.reels as unknown[]).map((k) => String(k).trim()).filter(Boolean)
      : parseStringList(req.body.reels, "reels", []);
  }

  if (rawBody.photoPath === "") rawBody.photoPath = null;
  if (rawBody.artPhotoPath === "") rawBody.artPhotoPath = null;
  if (rawBody.faceVideoPath === "") rawBody.faceVideoPath = null;

  // Strip masked bank fields so they don't overwrite valid stored bank details
  if (
    typeof rawBody.bankAccountNumber === "string" &&
    (rawBody.bankAccountNumber.includes("*") || rawBody.bankAccountNumber.includes("•"))
  ) {
    delete rawBody.bankAccountNumber;
  }
  if (
    typeof rawBody.bankIfsc === "string" &&
    (rawBody.bankIfsc.includes("*") || rawBody.bankIfsc.includes("•"))
  ) {
    delete rawBody.bankIfsc;
  }

  const parsed = profileUpdateSchema.safeParse(rawBody);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new ApiError(400, issue?.message ?? "Invalid profile update fields");
  }

  const data = parsed.data;
  const oldKeysToDelete: string[] = [];
  const keysToVerify: string[] = [];

  if ("photoPath" in data && data.photoPath !== undefined && data.photoPath !== existing.photoPath) {
    if (data.photoPath) keysToVerify.push(data.photoPath);
    if (existing.photoPath) oldKeysToDelete.push(existing.photoPath);
  }
  if ("artPhotoPath" in data && data.artPhotoPath !== undefined && data.artPhotoPath !== existing.artPhotoPath) {
    if (data.artPhotoPath) keysToVerify.push(data.artPhotoPath);
    if (existing.artPhotoPath) oldKeysToDelete.push(existing.artPhotoPath);
  }
  if ("faceVideoPath" in data && data.faceVideoPath !== undefined && data.faceVideoPath !== existing.faceVideoPath) {
    if (data.faceVideoPath) keysToVerify.push(data.faceVideoPath);
    if (existing.faceVideoPath) oldKeysToDelete.push(existing.faceVideoPath);
  }
  if (data.reels) {
    for (const r of data.reels) {
      if (!existing.reels?.includes(r)) {
        keysToVerify.push(r);
      }
    }
    for (const oldR of existing.reels ?? []) {
      if (!data.reels.includes(oldR)) {
        oldKeysToDelete.push(oldR);
      }
    }
  }

  if (keysToVerify.length > 0) {
    await mediaService.assertOwnedMediaKeysExist(userId, keysToVerify);
  }

  const activeReelCount = data.reels ? data.reels.length : (existing.reels?.length ?? 0);
  let safePrimaryReel = data.primaryReel;
  if (safePrimaryReel != null && activeReelCount > 0) {
    if (safePrimaryReel >= activeReelCount) {
      safePrimaryReel = Math.max(0, activeReelCount - 1);
    }
  }

  const travelSetting = data.travelSetting ?? existing.travelSetting;
  const updatePayload: artistService.ArtistProfileUpdate = {
    ...data,
    primaryReel: safePrimaryReel,
    travelChargeInr:
      travelSetting === "excluding"
        ? (data.travelChargeInr ?? existing.travelChargeInr)
        : 0,
    stayChargeInr:
      travelSetting === "excluding"
        ? (data.stayChargeInr ?? existing.stayChargeInr)
        : 0,
  };

  await artistService.updateProfileByUserId(userId, updatePayload);

  if (oldKeysToDelete.length > 0) {
    await mediaService.deleteMediaMany(oldKeysToDelete);
  }

  const updated = await artistService.findProfileByUserId(userId);
  sendSuccess(res, {
    message: "Profile updated successfully.",
    profile: toFlatArtist(updated!),
  });
}
