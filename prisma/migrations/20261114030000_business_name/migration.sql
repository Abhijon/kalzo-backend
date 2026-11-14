-- Replace booking details with business name on customer profiles
ALTER TABLE "customer_profiles" RENAME COLUMN "booking_details" TO "business_name";
