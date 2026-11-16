-- Drop publication status; single verificationStatus is enough
ALTER TABLE "artist_profiles" DROP COLUMN IF EXISTS "status";

-- Normalize existing verification values, then set default to unverified
UPDATE "artist_profiles"
SET "verification_status" = CASE
  WHEN "verification_status" IN ('verified') THEN 'verified'
  WHEN "verification_status" IN ('failed', 'rejected') THEN 'rejected'
  ELSE 'unverified'
END;

ALTER TABLE "artist_profiles" ALTER COLUMN "verification_status" SET DEFAULT 'unverified';

ALTER TABLE "artist_profiles" ADD COLUMN IF NOT EXISTS "rejection_reason" TEXT;
