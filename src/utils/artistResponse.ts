import type { KycStatus, VerificationStatus } from "@prisma/client";
import { publicUrl } from "../services/media.service";

function mediaUrl(key: string | null | undefined): string | null {
  if (!key) return null;
  const url = publicUrl(key);
  return url || null;
}

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
  /** S3 object key */
  photoPath: string | null;
  artPhotoPath: string | null;
  faceVideoPath: string | null;
  reels: string[];
  /** Public S3 URLs (for <img>/<video> src) */
  photoUrl: string | null;
  artPhotoUrl: string | null;
  faceVideoUrl: string | null;
  reelUrls: string[];
  primaryReel: number;
  verificationStatus: VerificationStatus;
  rejectionReason: string | null;
  kycStatus: KycStatus;
  kycClientId: string | null;
  kycVerifiedName: string | null;
  kycMaskedAadhaar: string | null;
  kycDob: string | null;
  kycGender: string | null;
  kycVerifiedAt: Date | null;
  bankAccountHolder: string | null;
  bankName: string | null;
  bankAccountNumber: string | null;
  bankIfsc: string | null;
  avgRating: number;
  reviewCount: number;
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
  kycStatus: KycStatus;
  kycClientId: string | null;
  kycVerifiedName: string | null;
  kycMaskedAadhaar: string | null;
  kycDob: string | null;
  kycGender: string | null;
  kycVerifiedAt: Date | null;
  bankAccountHolder: string | null;
  bankName: string | null;
  bankAccountNumber: string | null;
  bankIfsc: string | null;
  avgRating?: number;
  reviewCount?: number;
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
    photoUrl: mediaUrl(row.photoPath),
    artPhotoUrl: mediaUrl(row.artPhotoPath),
    faceVideoUrl: mediaUrl(row.faceVideoPath),
    reelUrls: (row.reels ?? []).map((key) => mediaUrl(key)).filter((u): u is string => Boolean(u)),
    primaryReel: row.primaryReel,
    verificationStatus: row.verificationStatus,
    rejectionReason: row.rejectionReason,
    kycStatus: row.kycStatus,
    kycClientId: row.kycClientId,
    kycVerifiedName: row.kycVerifiedName,
    kycMaskedAadhaar: row.kycMaskedAadhaar,
    kycDob: row.kycDob,
    kycGender: row.kycGender,
    kycVerifiedAt: row.kycVerifiedAt,
    bankAccountHolder: row.bankAccountHolder,
    bankName: row.bankName,
    bankAccountNumber: row.bankAccountNumber,
    bankIfsc: row.bankIfsc,
    avgRating: Number(row.avgRating ?? 0),
    reviewCount: Number(row.reviewCount ?? 0),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** Public verified list: no bank, face video, KYC PII, or rejection reason. */
export function toPublicArtist(row: ProfileWithUser) {
  const flat = toFlatArtist(row);
  const {
    faceVideoPath: _face,
    faceVideoUrl: _faceUrl,
    rejectionReason: _reason,
    bankAccountHolder: _holder,
    bankName: _bank,
    bankAccountNumber: _acc,
    bankIfsc: _ifsc,
    kycClientId: _kycClient,
    kycMaskedAadhaar: _aadhaar,
    kycDob: _dob,
    kycGender: _gender,
    kycVerifiedAt: _kycAt,
    ...publicArtist
  } = flat;
  return publicArtist;
}

/** Public artist detail (e.g. GET /artists/:id): same as list, plus live face video. */
export function toPublicArtistDetail(row: ProfileWithUser) {
  const flat = toFlatArtist(row);
  const {
    rejectionReason: _reason,
    bankAccountHolder: _holder,
    bankName: _bank,
    bankAccountNumber: _acc,
    bankIfsc: _ifsc,
    kycClientId: _kycClient,
    kycMaskedAadhaar: _aadhaar,
    kycDob: _dob,
    kycGender: _gender,
    kycVerifiedAt: _kycAt,
    ...detail
  } = flat;
  return detail;
}
