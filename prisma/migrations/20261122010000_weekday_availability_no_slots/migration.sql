-- Drop slot-based booking link
ALTER TABLE "bookings" DROP CONSTRAINT IF EXISTS "bookings_slot_id_fkey";
DROP INDEX IF EXISTS "bookings_slot_id_idx";
ALTER TABLE "bookings" DROP COLUMN IF EXISTS "slot_id";

-- Remove old date + slot tables
DROP TABLE IF EXISTS "artist_time_slots";
DROP TABLE IF EXISTS "artist_availability_days";

-- Recurring weekday availability (0=Sunday … 6=Saturday)
CREATE TABLE "artist_availability_weekdays" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "artist_profile_id" UUID NOT NULL,
    "weekday" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "artist_availability_weekdays_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "artist_availability_weekdays_weekday_is_active_idx" ON "artist_availability_weekdays"("weekday", "is_active");
CREATE UNIQUE INDEX "artist_availability_weekdays_artist_profile_id_weekday_key" ON "artist_availability_weekdays"("artist_profile_id", "weekday");

ALTER TABLE "artist_availability_weekdays" ADD CONSTRAINT "artist_availability_weekdays_artist_profile_id_fkey" FOREIGN KEY ("artist_profile_id") REFERENCES "artist_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
