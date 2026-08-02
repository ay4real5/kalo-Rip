-- Double-booking prevention and diary indexes.
--
-- The application checked for a conflicting booking before inserting, but that
-- check ran outside the transaction and nothing in the database enforced it,
-- so two confirmations arriving together could both pass and both commit. A
-- phone booking and a portal booking racing for the same slot double-booked
-- the instructor.
--
-- The exclusion constraint below makes overlapping CONFIRMED lessons for one
-- instructor impossible to represent, whatever the application does. Cancelled
-- and completed rows are exempt, so a slot frees up when a lesson is cancelled
-- and history can hold overlaps.
--
-- NOTE: this migration FAILS if overlapping CONFIRMED bookings already exist.
-- Find them first with:
--
--   SELECT a.id, b.id, a.instructor_id, a.starts_at, b.starts_at
--   FROM bookings a
--   JOIN bookings b
--     ON a.instructor_id = b.instructor_id
--    AND a.id < b.id
--    AND a.status = 'CONFIRMED'
--    AND b.status = 'CONFIRMED'
--    AND a.starts_at < b.ends_at
--    AND b.starts_at < a.ends_at;
--
-- Resolve each pair (cancel or move one) before deploying.

-- Needed to combine equality on instructor_id with range overlap in one GiST
-- index. Available on Supabase and standard Postgres contrib.
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE INDEX IF NOT EXISTS "bookings_instructor_id_starts_at_idx"
  ON "bookings" ("instructor_id", "starts_at");

CREATE INDEX IF NOT EXISTS "bookings_customer_id_starts_at_idx"
  ON "bookings" ("customer_id", "starts_at");

CREATE INDEX IF NOT EXISTS "bookings_status_starts_at_idx"
  ON "bookings" ("status", "starts_at");

-- '[)' — a lesson ending at 10:00 does not overlap one starting at 10:00.
ALTER TABLE "bookings"
  ADD CONSTRAINT "bookings_no_overlapping_confirmed"
  EXCLUDE USING gist (
    "instructor_id" WITH =,
    tstzrange("starts_at", "ends_at", '[)') WITH &&
  )
  WHERE ("status" = 'CONFIRMED');
