-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('unpaid', 'created', 'paid', 'failed');

-- AlterTable
ALTER TABLE "bookings" ADD COLUMN "payment_status" "PaymentStatus" NOT NULL DEFAULT 'unpaid';
ALTER TABLE "bookings" ADD COLUMN "payment_idempotency_key" TEXT;
ALTER TABLE "bookings" ADD COLUMN "razorpay_order_id" TEXT;
ALTER TABLE "bookings" ADD COLUMN "razorpay_payment_id" TEXT;
ALTER TABLE "bookings" ADD COLUMN "paid_at" TIMESTAMPTZ(6);

-- CreateIndex
CREATE UNIQUE INDEX "bookings_payment_idempotency_key_key" ON "bookings"("payment_idempotency_key");
CREATE UNIQUE INDEX "bookings_razorpay_order_id_key" ON "bookings"("razorpay_order_id");
CREATE UNIQUE INDEX "bookings_razorpay_payment_id_key" ON "bookings"("razorpay_payment_id");
CREATE INDEX "bookings_payment_status_idx" ON "bookings"("payment_status");
