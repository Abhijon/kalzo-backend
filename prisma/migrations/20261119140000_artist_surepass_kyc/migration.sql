-- CreateEnum
CREATE TYPE "KycStatus" AS ENUM ('not_started', 'pending', 'success', 'failed');

-- AlterTable
ALTER TABLE "artist_profiles" ADD COLUMN "kyc_status" "KycStatus" NOT NULL DEFAULT 'not_started';
ALTER TABLE "artist_profiles" ADD COLUMN "kyc_client_id" TEXT;
ALTER TABLE "artist_profiles" ADD COLUMN "kyc_verified_name" TEXT;
ALTER TABLE "artist_profiles" ADD COLUMN "kyc_masked_aadhaar" TEXT;
ALTER TABLE "artist_profiles" ADD COLUMN "kyc_dob" TEXT;
ALTER TABLE "artist_profiles" ADD COLUMN "kyc_gender" TEXT;
ALTER TABLE "artist_profiles" ADD COLUMN "kyc_verified_at" TIMESTAMPTZ(6);
ALTER TABLE "artist_profiles" ADD COLUMN "kyc_raw" JSONB;

-- CreateIndex
CREATE INDEX "artist_profiles_kyc_client_id_idx" ON "artist_profiles"("kyc_client_id");
