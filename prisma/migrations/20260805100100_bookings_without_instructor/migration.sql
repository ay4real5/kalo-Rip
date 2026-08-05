-- Allow a booking to exist before a driver is chosen.
--
-- The phone agent now secures the *time* for a learner and tells them an
-- instructor will be in touch; an admin assigns the driver afterwards in the
-- portal. So instructor_id has to be nullable, and we record when the
-- assignment happened.
--
-- ON DELETE SET NULL rather than CASCADE: removing an instructor must not
-- silently delete a learner's lesson. It falls back to unassigned so the admin
-- can give it to someone else.
--
-- Note the existing bookings_no_overlapping_confirmed exclusion constraint
-- still does its job. Rows with a NULL instructor_id never conflict under an
-- exclusion constraint, which is exactly right — an unassigned lesson is not
-- on anyone's diary yet. The moment an admin assigns one, the constraint
-- applies and blocks a genuine double-booking.

ALTER TABLE "bookings" DROP CONSTRAINT "bookings_instructor_id_fkey";

ALTER TABLE "bookings"
  ADD COLUMN "assigned_at" TIMESTAMP(3),
  ALTER COLUMN "instructor_id" DROP NOT NULL;

ALTER TABLE "bookings"
  ADD CONSTRAINT "bookings_instructor_id_fkey"
  FOREIGN KEY ("instructor_id") REFERENCES "instructors"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Existing rows all have a driver already, so they are assigned as of now.
UPDATE "bookings" SET "assigned_at" = "created_at" WHERE "instructor_id" IS NOT NULL;

-- The assignment queue is read by status and ordered by when the lesson is.
CREATE INDEX IF NOT EXISTS "bookings_status_starts_at_unassigned_idx"
  ON "bookings" ("starts_at") WHERE "instructor_id" IS NULL;
