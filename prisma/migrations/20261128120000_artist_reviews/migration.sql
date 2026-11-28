-- AlterTable
ALTER TABLE "artist_profiles" ADD COLUMN "avg_rating" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "artist_profiles" ADD COLUMN "review_count" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "artist_reviews" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "booking_id" UUID NOT NULL,
    "customer_user_id" UUID NOT NULL,
    "artist_profile_id" UUID NOT NULL,
    "rating" INTEGER NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "artist_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "artist_reviews_booking_id_key" ON "artist_reviews"("booking_id");
CREATE INDEX "artist_reviews_artist_profile_id_created_at_idx" ON "artist_reviews"("artist_profile_id", "created_at");
CREATE INDEX "artist_reviews_customer_user_id_idx" ON "artist_reviews"("customer_user_id");

-- AddForeignKey
ALTER TABLE "artist_reviews" ADD CONSTRAINT "artist_reviews_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "artist_reviews" ADD CONSTRAINT "artist_reviews_artist_profile_id_fkey" FOREIGN KEY ("artist_profile_id") REFERENCES "artist_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
