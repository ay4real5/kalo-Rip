-- Drop the dead auto_confirm column.
--
-- It was editable in the instructor portal and saved here, but nothing ever
-- read it: bookings were always created CONFIRMED. A control that silently
-- does nothing is worse than no control, so the toggle and the column go.
--
-- Reviving it properly means a PENDING booking status, which needs its own
-- work: Postgres won't let an enum value be added and used in one transaction,
-- so it takes two migrations, and the bookings_no_overlapping_confirmed
-- exclusion constraint has to be widened to cover PENDING or a pending lesson
-- won't hold its slot.

ALTER TABLE "instructors" DROP COLUMN "auto_confirm";
