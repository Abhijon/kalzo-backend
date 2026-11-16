-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('unverified', 'verified', 'rejected');

-- Ensure existing rows only use enum values before casting
UPDATE "artist_profiles"
SET "verification_status" = CASE
  WHEN "verification_status" = 'verified' THEN 'verified'
  WHEN "verification_status" = 'rejected' THEN 'rejected'
  ELSE 'unverified'
END;

-- AlterColumn: text -> enum
ALTER TABLE "artist_profiles"
  ALTER COLUMN "verification_status" DROP DEFAULT,
  ALTER COLUMN "verification_status" TYPE "VerificationStatus" USING ("verification_status"::"VerificationStatus"),
  ALTER COLUMN "verification_status" SET DEFAULT 'unverified'::"VerificationStatus";
