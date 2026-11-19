import type { Request, Response } from "express";
import { z } from "zod";
import * as artistService from "../services/artist.service";
import * as authService from "../services/auth.service";
import * as mediaService from "../services/media.service";
import * as roleService from "../services/role.service";
import { toFlatArtist, toPublicArtist } from "../utils/artistResponse";
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
  return artistService.ensureProfileByUserId(userId);
}

/** GET /artist/profile — same flat shape as admin get-by-id (submitted POST data). */
export async function getProfile(req: Request, res: Response) {
  const profile = await requireArtistProfile(req.user!.id);
  sendSuccess(res, { profile: toFlatArtist(profile) });
}

/** GET /artists/verified?page=1&limit=10 — public list of verified artists */
export async function listVerifiedArtists(req: Request, res: Response) {
  const q = parsePagination(req.query);
  const { artists, totalCount } = await artistService.listProfiles({
    limit: q.limit,
    offset: q.offset,
    verificationStatus: VERIFICATION_STATUS.VERIFIED,
  });

  sendSuccess(res, {
    artists: artists.map(toPublicArtist),
    pagination: paginationMeta(totalCount, q),
  });
}

/**
 * POST /artist/profile — one multipart form-data submit.
 * Fields: profile text + bank details + photo, artPhoto, faceVideo, reels (2–4).
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

  if (!photo) throw new ApiError(400, "photo is required");
  if (!artPhoto) throw new ApiError(400, "artPhoto is required");
  if (!faceVideo) throw new ApiError(400, "faceVideo is required");
  if (reelFiles.length < 2) throw new ApiError(400, "At least 2 reels are required");
  if (reelFiles.length > 4) throw new ApiError(400, "At most 4 reels are allowed");

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

  await artistService.submitProfileByUserId(userId);
  const profile = await artistService.findProfileByUserId(userId);
  if (!profile) throw new ApiError(404, "Artist profile not found");
  sendSuccess(res, {
    message: "Profile submitted for admin verification.",
    profile: toFlatArtist(profile),
  });
}
