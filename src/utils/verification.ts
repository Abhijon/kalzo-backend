import { VerificationStatus } from "@prisma/client";

export { VerificationStatus };

export const VERIFICATION_STATUS = {
  UNVERIFIED: VerificationStatus.unverified,
  VERIFIED: VerificationStatus.verified,
  REJECTED: VerificationStatus.rejected,
} as const;
