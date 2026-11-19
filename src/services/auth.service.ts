import { prisma } from "../lib/prisma";

const publicUserFields = {
  id: true,
  email: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  role: { select: { name: true } },
} as const;

export function findUserByEmail(email: string) {
  return prisma.user.findUnique({
    where: { email },
    select: publicUserFields,
  });
}

export function findUserWithProfileById(id: string) {
  return prisma.user.findUnique({
    where: { id },
    select: {
      ...publicUserFields,
      customerProfile: {
        select: {
          id: true,
          fullName: true,
          location: true,
          customerType: true,
          reasonForBooking: true,
          businessName: true,
          mobileNumber: true,
        },
      },
      artistProfile: {
        select: {
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
        },
      },
    },
  });
}

export function activateUser(id: string) {
  return prisma.user.update({
    where: { id },
    data: { isActive: true },
    select: publicUserFields,
  });
}
