-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('pending', 'accepted', 'rejected', 'job_started', 'completed');

-- CreateTable
CREATE TABLE "art_forms" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "type" TEXT NOT NULL,
    "subtypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "art_forms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "location_states" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "location_states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "location_cities" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "state_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "location_cities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "artist_availability_days" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "artist_profile_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "artist_availability_days_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "artist_time_slots" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "day_id" UUID NOT NULL,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "artist_time_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "customer_user_id" UUID NOT NULL,
    "artist_profile_id" UUID NOT NULL,
    "slot_id" UUID NOT NULL,
    "event_date" DATE NOT NULL,
    "address" TEXT NOT NULL,
    "guests" TEXT,
    "note" TEXT,
    "amount_inr" INTEGER NOT NULL DEFAULT 0,
    "status" "BookingStatus" NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "art_forms_type_key" ON "art_forms"("type");

-- CreateIndex
CREATE UNIQUE INDEX "location_states_name_key" ON "location_states"("name");

-- CreateIndex
CREATE INDEX "location_cities_name_idx" ON "location_cities"("name");

-- CreateIndex
CREATE UNIQUE INDEX "location_cities_state_id_name_key" ON "location_cities"("state_id", "name");

-- CreateIndex
CREATE INDEX "artist_availability_days_date_is_active_idx" ON "artist_availability_days"("date", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "artist_availability_days_artist_profile_id_date_key" ON "artist_availability_days"("artist_profile_id", "date");

-- CreateIndex
CREATE INDEX "artist_time_slots_day_id_idx" ON "artist_time_slots"("day_id");

-- CreateIndex
CREATE INDEX "bookings_customer_user_id_idx" ON "bookings"("customer_user_id");

-- CreateIndex
CREATE INDEX "bookings_artist_profile_id_idx" ON "bookings"("artist_profile_id");

-- CreateIndex
CREATE INDEX "bookings_slot_id_idx" ON "bookings"("slot_id");

-- CreateIndex
CREATE INDEX "bookings_status_idx" ON "bookings"("status");

-- AddForeignKey
ALTER TABLE "location_cities" ADD CONSTRAINT "location_cities_state_id_fkey" FOREIGN KEY ("state_id") REFERENCES "location_states"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "artist_availability_days" ADD CONSTRAINT "artist_availability_days_artist_profile_id_fkey" FOREIGN KEY ("artist_profile_id") REFERENCES "artist_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "artist_time_slots" ADD CONSTRAINT "artist_time_slots_day_id_fkey" FOREIGN KEY ("day_id") REFERENCES "artist_availability_days"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_customer_user_id_fkey" FOREIGN KEY ("customer_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_artist_profile_id_fkey" FOREIGN KEY ("artist_profile_id") REFERENCES "artist_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_slot_id_fkey" FOREIGN KEY ("slot_id") REFERENCES "artist_time_slots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
