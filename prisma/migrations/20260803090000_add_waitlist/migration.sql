-- Waitlist: learners waiting for a slot that isn't currently free.
--
-- When a booking is cancelled the freed slot is matched against these entries
-- and the earliest-joined matching learners are texted. Cancellations
-- previously just vanished — the slot went back into general availability and
-- nobody was told, so late cancellations tended to stay empty.

-- CreateEnum
CREATE TYPE "WaitlistStatus" AS ENUM ('ACTIVE', 'NOTIFIED', 'CONVERTED', 'CANCELLED');

-- CreateTable
CREATE TABLE "waitlist_entries" (
    "id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "instructor_id" TEXT,
    "earliest_date" TIMESTAMP(3) NOT NULL,
    "latest_date" TIMESTAMP(3) NOT NULL,
    "earliest_time" TEXT,
    "latest_time" TEXT,
    "status" "WaitlistStatus" NOT NULL DEFAULT 'ACTIVE',
    "notified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "waitlist_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "waitlist_entries_status_instructor_id_idx" ON "waitlist_entries"("status", "instructor_id");

-- CreateIndex
CREATE INDEX "waitlist_entries_customer_id_idx" ON "waitlist_entries"("customer_id");

-- AddForeignKey
ALTER TABLE "waitlist_entries" ADD CONSTRAINT "waitlist_entries_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "waitlist_entries" ADD CONSTRAINT "waitlist_entries_instructor_id_fkey" FOREIGN KEY ("instructor_id") REFERENCES "instructors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
