import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";

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
};

export const artistProfileSelect = {
  id: true,
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
  status: true,
  verificationStatus: true,
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
    select: artistProfileSelect,
  });
}

export function updateProfileByUserId(userId: string, data: ArtistProfileUpdate) {
  return prisma.artistProfile.update({
    where: { userId },
    data,
    select: artistProfileSelect,
  });
}

export function submitProfileByUserId(userId: string) {
  return prisma.artistProfile.update({
    where: { userId },
    data: {
      status: "pending_review",
      verificationStatus: "submitted",
    },
    select: artistProfileSelect,
  });
}
