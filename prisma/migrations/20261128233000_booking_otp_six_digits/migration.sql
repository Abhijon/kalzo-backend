-- Booking arrival/closing OTPs are six digits.
ALTER TABLE "bookings"
  ALTER COLUMN "arrival_code" TYPE VARCHAR(6),
  ALTER COLUMN "closing_code" TYPE VARCHAR(6);

-- Remint any leftover four-digit codes so verify expects six digits.
UPDATE "bookings"
SET
  "arrival_code" = LPAD((FLOOR(RANDOM() * 1000000))::int::text, 6, '0'),
  "closing_code" = LPAD((FLOOR(RANDOM() * 1000000))::int::text, 6, '0'),
  "arrival_attempts" = 0,
  "closing_attempts" = 0
WHERE "payment_status" = 'paid'
  AND (
    "arrival_code" IS NULL
    OR "closing_code" IS NULL
    OR LENGTH("arrival_code") <> 6
    OR LENGTH("closing_code") <> 6
  );
