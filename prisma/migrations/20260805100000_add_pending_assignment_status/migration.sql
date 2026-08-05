-- Add the PENDING_ASSIGNMENT booking status.
--
-- Deliberately alone in its own migration: Postgres will not let a new enum
-- value be *used* in the same transaction that adds it, and Prisma runs each
-- migration in one. The follow-up migration reshapes the table; anything that
-- references 'PENDING_ASSIGNMENT' has to wait for this one to commit.

ALTER TYPE "BookingStatus" ADD VALUE IF NOT EXISTS 'PENDING_ASSIGNMENT';
