import { KycStatus } from "@prisma/client";
import { ApiError } from "./apiError";

export { KycStatus };

export const KYC_STATUS = {
  NOT_STARTED: KycStatus.not_started,
  PENDING: KycStatus.pending,
  SUCCESS: KycStatus.success,
  FAILED: KycStatus.failed,
} as const;

/** Digilocker must succeed before profile submit and admin verify. */
export function assertKycCompleted(kycStatus: KycStatus) {
  if (kycStatus === KYC_STATUS.SUCCESS) return;

  if (kycStatus === KYC_STATUS.PENDING) {
    throw new ApiError(
      400,
      "Digilocker KYC is still in progress. Finish Digilocker, then call /artist/kyc/digilocker/complete.",
    );
  }

  if (kycStatus === KYC_STATUS.FAILED) {
    throw new ApiError(
      400,
      "Digilocker KYC failed. Start again with POST /artist/kyc/digilocker/initiate.",
    );
  }

  throw new ApiError(
    400,
    "Complete Digilocker KYC before continuing. Call POST /artist/kyc/digilocker/initiate.",
  );
}
