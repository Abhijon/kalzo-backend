-- Expand booking lifecycle: arrival OTP → venue video → closing OTP.
-- Legacy job_started maps to performing. Payout release stays admin-manual.

DO $$ BEGIN
  CREATE TYPE "PayoutStatus" AS ENUM ('not_applicable', 'setup_required', 'released');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "bookings"
  ADD COLUMN IF NOT EXISTS "arrival_code" VARCHAR(4),
  ADD COLUMN IF NOT EXISTS "closing_code" VARCHAR(4),
  ADD COLUMN IF NOT EXISTS "arrival_attempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "closing_attempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "venue_video_path" TEXT,
  ADD COLUMN IF NOT EXISTS "payout_status" "PayoutStatus" NOT NULL DEFAULT 'not_applicable';

CREATE TYPE "BookingStatus_new" AS ENUM (
  'pending',
  'accepted',
  'rejected',
  'arrived',
  'arrival_confirmed',
  'performing',
  'finished',
  'completed'
);

ALTER TABLE "bookings"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "BookingStatus_new"
    USING (
      CASE "status"::text
        WHEN 'job_started' THEN 'performing'::"BookingStatus_new"
        ELSE "status"::text::"BookingStatus_new"
      END
    );

DROP TYPE "BookingStatus";
ALTER TYPE "BookingStatus_new" RENAME TO "BookingStatus";
ALTER TABLE "bookings" ALTER COLUMN "status" SET DEFAULT 'pending'::"BookingStatus";

CREATE INDEX IF NOT EXISTS "bookings_payout_status_idx" ON "bookings"("payout_status");
