-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "paid_at" TIMESTAMP(3),
ADD COLUMN     "payment_reference" TEXT;
