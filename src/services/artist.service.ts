import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { VERIFICATION_STATUS } from "../utils/verification";

export type ArtistProfileInput = {
  mobileNumber: string;
};

export type ArtistProfileUpdate = {
  stageName?: string | null;
  legalName?: string | null;
  baseCity?: string | null;
  stateName?: string | null;
  currentCity?: string | null;
  currentState?: string | null;
  preferredCities?: string[];
  preferredStates?: string[];
  discipline?: string | null;
  subcategory?: string | null;
  bio?: string | null;
  instagram?: string | null;
  rateInr?: number | null;
  pricingUnit?: string;
  travelSetting?: string;
  travelChargeInr?: number;
  stayChargeInr?: number;
  cityRates?: Prisma.InputJsonValue;
  photoPath?: string | null;
  artPhotoPath?: string | null;
  faceVideoPath?: string | null;
  reels?: string[];
  primaryReel?: number;
  bankAccountHolder?: string | null;
  bankName?: string | null;
  bankAccountNumber?: string | null;
  bankIfsc?: string | null;
};

export const artistProfileSelect = {
  id: true,
  userId: true,
  mobileNumber: true,
  stageName: true,
  legalName: true,
  baseCity: true,
  stateName: true,
  currentCity: true,
  currentState: true,
  preferredCities: true,
  preferredStates: true,
  discipline: true,
  subcategory: true,
  bio: true,
  instagram: true,
  rateInr: true,
  pricingUnit: true,
  travelSetting: true,
  travelChargeInr: true,
  stayChargeInr: true,
  cityRates: true,
  photoPath: true,
  artPhotoPath: true,
  faceVideoPath: true,
  reels: true,
  primaryReel: true,
  verificationStatus: true,
  rejectionReason: true,
  kycStatus: true,
  kycClientId: true,
  kycVerifiedName: true,
  kycMaskedAadhaar: true,
  kycDob: true,
  kycGender: true,
  kycVerifiedAt: true,
  bankAccountHolder: true,
  bankName: true,
  bankAccountNumber: true,
  bankIfsc: true,
  avgRating: true,
  reviewCount: true,
  createdAt: true,
  updatedAt: true,
} as const;

export function createArtist(email: string, roleId: string, profile: ArtistProfileInput) {
  return prisma.user.create({
    data: { email, roleId, artistProfile: { create: profile } },
    select: {
      id: true,
      email: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      role: { select: { name: true } },
      artistProfile: { select: artistProfileSelect },
    },
  });
}

export function findProfileByUserId(userId: string) {
  return prisma.artistProfile.findUnique({
    where: { userId },
    select: {
      ...artistProfileSelect,
      user: { select: { id: true, email: true, isActive: true } },
    },
  });
}

/**
 * ARTIST users always need an artist_profiles row (signup creates it).
 * Older/test accounts may be missing one — create a stub so KYC/profile work.
 */
export async function ensureProfileByUserId(userId: string, mobileNumber = "0000000000") {
  const existing = await findProfileByUserId(userId);
  if (existing) return existing;

  return prisma.artistProfile.create({
    data: { userId, mobileNumber },
    select: {
      ...artistProfileSelect,
      user: { select: { id: true, email: true, isActive: true } },
    },
  });
}

export function findProfileById(id: string) {
  return prisma.artistProfile.findUnique({
    where: { id },
    select: {
      ...artistProfileSelect,
      user: { select: { id: true, email: true, isActive: true } },
    },
  });
}

const listSelect = {
  ...artistProfileSelect,
  user: { select: { id: true, email: true, isActive: true } },
} as const;

/** Location tier for city/state finder filters. */
export type LocationTier = "all" | "current" | "base" | "preferred";

function caseVariants(value: string): string[] {
  const t = value.trim();
  if (!t) return [];
  const lower = t.toLowerCase();
  const title = lower.replace(/\b\w/g, (c) => c.toUpperCase());
  return [...new Set([t, lower, title, t.toUpperCase()])];
}

/** Prisma `has` on string[] is case-sensitive — try common casings. */
function stringArrayHasInsensitive(
  field: "preferredCities" | "preferredStates",
  value: string,
): Prisma.ArtistProfileWhereInput {
  const variants = caseVariants(value);
  if (variants.length === 1) return { [field]: { has: variants[0] } };
  return { OR: variants.map((v) => ({ [field]: { has: v } })) };
}

function cityTierWhere(
  city: string,
  tier: LocationTier,
): Prisma.ArtistProfileWhereInput {
  const base = { baseCity: { equals: city, mode: "insensitive" as const } };
  const current = { currentCity: { equals: city, mode: "insensitive" as const } };
  const preferred = stringArrayHasInsensitive("preferredCities", city);

  if (tier === "base") return base;
  if (tier === "current") return current;
  if (tier === "preferred") return preferred;
  return { OR: [base, current, preferred] };
}

function stateTierWhere(
  state: string,
  tier: LocationTier,
): Prisma.ArtistProfileWhereInput {
  const base = { stateName: { equals: state, mode: "insensitive" as const } };
  const current = { currentState: { equals: state, mode: "insensitive" as const } };
  const preferred = stringArrayHasInsensitive("preferredStates", state);

  if (tier === "base") return base;
  if (tier === "current") return current;
  if (tier === "preferred") return preferred;
  return { OR: [base, current, preferred] };
}

export function parseLocationTier(raw: unknown): LocationTier | undefined {
  if (raw == null || raw === "") return undefined;
  const v = String(raw).trim().toLowerCase();
  if (v === "all") return "all";
  if (v === "base") return "base";
  if (v === "current" || v === "visiting") return "current";
  if (v === "preferred" || v === "pref") return "preferred";
  return undefined;
}

export async function listProfiles(opts: {
  limit: number;
  offset: number;
  verificationStatus?: (typeof VERIFICATION_STATUS)[keyof typeof VERIFICATION_STATUS];
  discipline?: string;
  subcategory?: string;
  city?: string;
  state?: string;
  /** Narrow city/state match: all | current | base | preferred */
  tier?: LocationTier;
  maxRate?: number;
  /** At least one recurring weekday is active (Any day filter). */
  anyDay?: boolean;
  /** Calendar date → filter artists whose recurring weekday is active that day. */
  date?: Date;
  weekday?: number;
}) {
  const and: Prisma.ArtistProfileWhereInput[] = [];
  const tier: LocationTier = opts.tier ?? "all";

  if (opts.verificationStatus) {
    and.push({ verificationStatus: opts.verificationStatus });
  }
  if (opts.discipline) {
    and.push({ discipline: { equals: opts.discipline, mode: "insensitive" } });
  }
  if (opts.subcategory) {
    and.push({ subcategory: { equals: opts.subcategory, mode: "insensitive" } });
  }
  if (opts.maxRate != null) {
    and.push({ rateInr: { lte: opts.maxRate } });
  }
  if (opts.city) {
    and.push(cityTierWhere(opts.city, tier));
  } else if (opts.state) {
    and.push(stateTierWhere(opts.state, tier));
  }
  if (opts.anyDay) {
    and.push({
      availabilityWeekdays: {
        some: { isActive: true },
      },
    });
  } else {
    const weekday =
      opts.weekday ??
      (opts.date ? opts.date.getUTCDay() : undefined);
    if (weekday != null) {
      and.push({
        availabilityWeekdays: {
          some: { weekday, isActive: true },
        },
      });
    }
  }

  const where: Prisma.ArtistProfileWhereInput = and.length ? { AND: and } : {};

  const [artists, totalCount] = await Promise.all([
    prisma.artistProfile.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: opts.offset,
      take: opts.limit,
      select: listSelect,
    }),
    prisma.artistProfile.count({ where }),
  ]);

  return { artists, totalCount };
}

export function updateProfileByUserId(userId: string, data: ArtistProfileUpdate) {
  return prisma.artistProfile.update({
    where: { userId },
    data,
    select: artistProfileSelect,
  });
}

/** After multipart submit: ready for admin review (stays unverified until admin acts). */
export function submitProfileByUserId(userId: string) {
  return prisma.artistProfile.update({
    where: { userId },
    data: {
      verificationStatus: VERIFICATION_STATUS.UNVERIFIED,
      rejectionReason: null,
    },
    select: artistProfileSelect,
  });
}

export function verifyProfileById(id: string) {
  return prisma.artistProfile.update({
    where: { id },
    data: {
      verificationStatus: VERIFICATION_STATUS.VERIFIED,
      rejectionReason: null,
    },
    select: {
      ...artistProfileSelect,
      user: { select: { id: true, email: true, isActive: true } },
    },
  });
}

export function rejectProfileById(id: string, reason: string) {
  return prisma.artistProfile.update({
    where: { id },
    data: {
      verificationStatus: VERIFICATION_STATUS.REJECTED,
      rejectionReason: reason,
    },
    select: {
      ...artistProfileSelect,
      user: { select: { id: true, email: true, isActive: true } },
    },
  });
}
