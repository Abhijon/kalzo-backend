import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { ApiError } from "../utils/apiError";
import { KYC_STATUS } from "../utils/kyc";
import * as surepass from "./surepass.service";
import * as artistService from "./artist.service";
import { artistProfileSelect } from "./artist.service";

const kycSelect = {
  ...artistProfileSelect,
  user: { select: { id: true, email: true, isActive: true } },
} as const;

export function findProfileByKycClientId(clientId: string) {
  return prisma.artistProfile.findFirst({
    where: { kycClientId: clientId },
    select: kycSelect,
  });
}

export async function initiateDigilocker(userId: string) {
  const profile = await artistService.ensureProfileByUserId(userId);

  if (profile.kycStatus === KYC_STATUS.SUCCESS) {
    throw new ApiError(400, "KYC is already completed");
  }

  const session = await surepass.initializeDigilocker();

  const updated = await prisma.artistProfile.update({
    where: { userId },
    data: {
      kycStatus: KYC_STATUS.PENDING,
      kycClientId: session.client_id,
      kycVerifiedName: null,
      kycMaskedAadhaar: null,
      kycDob: null,
      kycGender: null,
      kycVerifiedAt: null,
      kycRaw: Prisma.DbNull,
    },
    select: kycSelect,
  });

  return {
    profile: updated,
    session: {
      clientId: session.client_id,
      token: session.token ?? null,
      url: session.url ?? null,
      expirySeconds: session.expiry_seconds ?? null,
    },
  };
}

export async function getKycStatus(userId: string) {
  const profile = await prisma.artistProfile.findUnique({
    where: { userId },
    select: {
      kycStatus: true,
      kycClientId: true,
      kycVerifiedName: true,
      kycMaskedAadhaar: true,
      kycDob: true,
      kycGender: true,
      kycVerifiedAt: true,
    },
  });
  if (!profile) throw new ApiError(404, "Artist profile not found");
  return profile;
}

/** After Digilocker success (client callback or webhook): download Aadhaar and persist fields. */
export async function completeKyc(clientId: string, opts: { userId?: string } = {}) {
  const profile = opts.userId
    ? await prisma.artistProfile.findUnique({ where: { userId: opts.userId }, select: kycSelect })
    : await findProfileByKycClientId(clientId);

  if (!profile) throw new ApiError(404, "No artist KYC session found for this client_id");
  if (profile.kycClientId && profile.kycClientId !== clientId) {
    throw new ApiError(400, "client_id does not match this artist's KYC session");
  }

  if (profile.kycStatus === KYC_STATUS.SUCCESS && profile.kycVerifiedName) {
    return profile;
  }

  const raw = await surepass.downloadAadhaar(clientId);
  const normalized = surepass.normalizeAadhaarPayload(raw);

  // Strip bulky base64 blobs before storing audit JSON.
  const { aadhaar_pdf: _pdf, aadhaar_xml: _xml, ...safeRaw } = raw;

  return prisma.artistProfile.update({
    where: { id: profile.id },
    data: {
      kycStatus: KYC_STATUS.SUCCESS,
      kycClientId: clientId,
      kycVerifiedName: normalized.name,
      kycMaskedAadhaar: normalized.maskedAadhaar,
      kycDob: normalized.dob,
      kycGender: normalized.gender,
      kycVerifiedAt: new Date(),
      kycRaw: safeRaw as Prisma.InputJsonValue,
      // Prefer Digilocker legal name when profile legal name is still empty.
      ...(normalized.name && !profile.legalName ? { legalName: normalized.name } : {}),
    },
    select: kycSelect,
  });
}

export async function markKycFailed(clientId: string) {
  const profile = await findProfileByKycClientId(clientId);
  if (!profile) return null;
  if (profile.kycStatus === KYC_STATUS.SUCCESS) return profile;

  return prisma.artistProfile.update({
    where: { id: profile.id },
    data: { kycStatus: KYC_STATUS.FAILED },
    select: kycSelect,
  });
}

export async function handleSurepassWebhook(payload: {
  client_id?: string;
  status?: string;
  type?: string;
}) {
  const clientId = payload.client_id?.trim();
  if (!clientId) throw new ApiError(400, "client_id is required");

  const status = (payload.status ?? "").toLowerCase();
  if (status === "success" || status === "completed" || status === "verified") {
    return completeKyc(clientId);
  }

  if (status === "failed" || status === "failure" || status === "error" || status === "cancelled") {
    return markKycFailed(clientId);
  }

  // Unknown status — keep pending; client can call /complete later.
  return findProfileByKycClientId(clientId);
}
