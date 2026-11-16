-- Bank details saved with profile submit; exposed on admin APIs only
ALTER TABLE "artist_profiles" ADD COLUMN "bank_account_holder" TEXT;
ALTER TABLE "artist_profiles" ADD COLUMN "bank_name" TEXT;
ALTER TABLE "artist_profiles" ADD COLUMN "bank_account_number" TEXT;
ALTER TABLE "artist_profiles" ADD COLUMN "bank_ifsc" TEXT;
