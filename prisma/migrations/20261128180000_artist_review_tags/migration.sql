-- AlterTable
ALTER TABLE "artist_reviews" ADD COLUMN "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
