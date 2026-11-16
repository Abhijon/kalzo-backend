import type { VerificationStatus } from "@prisma/client";

/** Flat artist row for API responses (no nested user object). */
export type FlatArtist = {
  id: string;
  userId: string;
  email: string | null;
  isActive: boolean | null;
  mobileNumber: string;
  stageName: string | null;
  legalName: string | null;
  baseCity: string | null;
  stateName: string | null;
  currentCity: string | null;
  currentState: string | null;
  preferredCities: string[];
  preferredStates: string[];
  discipline: string | null;
  subcategory: string | null;
  bio: string | null;
  instagram: string | null;
  rateInr: number | null;
  pricingUnit: string;
  travelSetting: string;
  travelChargeInr: number;
  stayChargeInr: number;
  cityRates: unknown;
  photoPath: string | null;
  artPhotoPath: string | null;
  faceVideoPath: string | null;
  reels: string[];
  primaryReel: number;
  verificationStatus: VerificationStatus;
  rejectionReason: string | null;
  bankAccountHolder: string | null;
  bankName: string | null;
  bankAccountNumber: string | null;
  bankIfsc: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type ProfileWithUser = {
  id: string;
  userId: string;
  mobileNumber: string;
  stageName: string | null;
  legalName: string | null;
  baseCity: string | null;
  stateName: string | null;
  currentCity: string | null;
  currentState: string | null;
  preferredCities: string[];
  preferredStates: string[];
  discipline: string | null;
  subcategory: string | null;
  bio: string | null;
  instagram: string | null;
  rateInr: number | null;
  pricingUnit: string;
  travelSetting: string;
  travelChargeInr: number;
  stayChargeInr: number;
  cityRates: unknown;
  photoPath: string | null;
  artPhotoPath: string | null;
  faceVideoPath: string | null;
  reels: string[];
  primaryReel: number;
  verificationStatus: VerificationStatus;
  rejectionReason: string | null;
  bankAccountHolder: string | null;
  bankName: string | null;
  bankAccountNumber: string | null;
  bankIfsc: string | null;
  createdAt: Date;
  updatedAt: Date;
  user?: { id: string; email: string; isActive: boolean } | null;
};

export function toFlatArtist(row: ProfileWithUser): FlatArtist {
  return {
    id: row.id,
    userId: row.userId,
    email: row.user?.email ?? null,
    isActive: row.user?.isActive ?? null,
    mobileNumber: row.mobileNumber,
    stageName: row.stageName,
    legalName: row.legalName,
    baseCity: row.baseCity,
    stateName: row.stateName,
    currentCity: row.currentCity,
    currentState: row.currentState,
    preferredCities: row.preferredCities,
    preferredStates: row.preferredStates,
    discipline: row.discipline,
    subcategory: row.subcategory,
    bio: row.bio,
    instagram: row.instagram,
    rateInr: row.rateInr,
    pricingUnit: row.pricingUnit,
    travelSetting: row.travelSetting,
    travelChargeInr: row.travelChargeInr,
    stayChargeInr: row.stayChargeInr,
    cityRates: row.cityRates,
    photoPath: row.photoPath,
    artPhotoPath: row.artPhotoPath,
    faceVideoPath: row.faceVideoPath,
    reels: row.reels,
    primaryReel: row.primaryReel,
    verificationStatus: row.verificationStatus,
    rejectionReason: row.rejectionReason,
    bankAccountHolder: row.bankAccountHolder,
    bankName: row.bankName,
    bankAccountNumber: row.bankAccountNumber,
    bankIfsc: row.bankIfsc,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** Public verified list: no bank, face video, or rejection reason. */
export function toPublicArtist(row: ProfileWithUser) {
  const flat = toFlatArtist(row);
  const {
    faceVideoPath: _face,
    rejectionReason: _reason,
    bankAccountHolder: _holder,
    bankName: _bank,
    bankAccountNumber: _acc,
    bankIfsc: _ifsc,
    ...publicArtist
  } = flat;
  return publicArtist;
}
