import { prisma } from "@/app/lib/prisma";
import { addMinutes, areIntervalsOverlapping } from "date-fns";
import {
  calendarDateOf,
  dayOfWeekFor,
  eachDateInRange,
  startOfLocalDay,
  zonedTimeToUtc,
} from "@/app/lib/timezone";
import type { Prisma } from "@prisma/client";

type BookingRecord = {
  id: string;
  startsAt: Date;
  endsAt: Date;
  status: string;
};

type HoldRecord = {
  id: string;
  startsAt: Date;
  endsAt: Date;
  expiresAt: Date;
};

export interface SearchSlotInput {
  postcode: string;
  transmission?: "MANUAL" | "AUTOMATIC" | "BOTH";
  preferredDate?: Date;
  startDate?: Date;
  endDate?: Date;
  lessonType?: "REGULAR" | "INTENSIVE" | "TEST" | "REFRESHER";
}

export interface AvailableSlot {
  instructorId: string;
  instructorName: string;
  startsAt: Date;
  endsAt: Date;
  pricePence: number;
  vehicleType?: string | null;
  postcode: string;
}

export interface BookingInput {
  customerId: string;
  instructorId: string;
  startsAt: Date;
  endsAt?: Date;
  lessonType?: "REGULAR" | "INTENSIVE" | "TEST" | "REFRESHER";
  notes?: string;
  source?: "PHONE_AI" | "PORTAL" | "ADMIN";
}

const DEFAULT_LESSON_MINUTES = 60;

export async function searchAvailableSlots(
  input: SearchSlotInput
): Promise<AvailableSlot[]> {
  // Window boundaries are local days, not server days.
  const startDate =
    input.startDate ?? input.preferredDate ?? startOfLocalDay(new Date());
  const endDate =
    input.endDate ?? addMinutes(startOfLocalDay(startDate), 15 * 24 * 60); // 2 weeks ahead

  const instructors = await findEligibleInstructors(input);
  const slots: AvailableSlot[] = [];

  for (const instructor of instructors) {
    if (!instructor.active || !instructor.acceptsNewLearners) continue;
    if (
      input.lessonType === "INTENSIVE" &&
      !instructor.offersIntensive
    ) {
      continue;
    }

    const availability = await getInstructorAvailability(instructor.id, startDate, endDate);

    // Match anything *overlapping* the window. Filtering on startsAt alone
    // missed a lesson that began before the window and ran into it, so the
    // opening slot of the range could be offered while already booked.
    const existingBookings: BookingRecord[] = await prisma.booking.findMany({
      where: {
        instructorId: instructor.id,
        status: { in: ["CONFIRMED"] },
        startsAt: { lt: endDate },
        endsAt: { gt: startDate },
      },
    });

    const holds: HoldRecord[] = await prisma.slotHold.findMany({
      where: {
        instructorId: instructor.id,
        expiresAt: { gt: new Date() },
        startsAt: { lt: endDate },
        endsAt: { gt: startDate },
      },
    });

    for (const range of availability) {
      const lessonMinutes = instructor.lessonDurationMinutes ?? DEFAULT_LESSON_MINUTES;
      let cursor = range.startsAt;
      while (addMinutes(cursor, lessonMinutes) <= range.endsAt) {
        const endsAt = addMinutes(cursor, lessonMinutes);
        const proposed = { startsAt: cursor, endsAt };

        // Half-open [start, end): a lesson ending at 10:00 does not clash with
        // one starting at 10:00. `inclusive: true` counted touching intervals
        // as overlapping, so every booking also blocked the hour either side
        // of itself and back-to-back lessons could never be offered. This
        // matches the database exclusion constraint, which uses '[)' too.
        const isBooked = existingBookings.some((b) =>
          areIntervalsOverlapping(
            { start: b.startsAt, end: b.endsAt },
            { start: proposed.startsAt, end: proposed.endsAt }
          )
        );

        const isHeld = holds.some((h) =>
          areIntervalsOverlapping(
            { start: h.startsAt, end: h.endsAt },
            { start: proposed.startsAt, end: proposed.endsAt }
          )
        );

        if (!isBooked && !isHeld) {
          slots.push({
            instructorId: instructor.id,
            instructorName: instructor.user.name ?? "Instructor",
            startsAt: proposed.startsAt,
            endsAt: proposed.endsAt,
            pricePence: instructor.hourlyRatePence,
            vehicleType: instructor.vehicleType,
            postcode: instructor.basePostcode,
          });
        }
        cursor = endsAt;
      }
    }
  }

  return slots.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime()).slice(0, 20);
}

async function findEligibleInstructors(input: SearchSlotInput) {
  const transmissionFilter: Prisma.InstructorWhereInput[] = [];
  if (!input.transmission || input.transmission === "BOTH") {
    transmissionFilter.push(
      { transmission: { in: ["MANUAL", "AUTOMATIC", "BOTH"] } },
      { transmission: "MANUAL" },
      { transmission: "AUTOMATIC" }
    );
  } else if (input.transmission === "MANUAL") {
    transmissionFilter.push(
      { transmission: { in: ["MANUAL", "BOTH"] } }
    );
  } else if (input.transmission === "AUTOMATIC") {
    transmissionFilter.push(
      { transmission: { in: ["AUTOMATIC", "BOTH"] } }
    );
  }

  const cleanedPostcode = input.postcode.replace(/\s+/g, " ").trim().toUpperCase();
  const outcode = cleanedPostcode.split(" ")[0];

  return prisma.instructor.findMany({
    where: {
      active: true,
      acceptsNewLearners: true,
      OR: transmissionFilter,
      servicePostcodes: { has: outcode },
    },
    include: { user: { select: { name: true } } },
  });
}

async function getInstructorAvailability(
  instructorId: string,
  startDate: Date,
  endDate: Date
) {
  const result: { startsAt: Date; endsAt: Date }[] = [];
  const weekly = await prisma.availability.findMany({
    where: { instructorId },
    orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
  });

  // Date-only columns are stored at midnight UTC while the window boundaries
  // are local midnight, so pad a day either side rather than lose an edge day
  // to the offset between them. Matching is done on calendar date below.
  const rangeStart = addMinutes(startDate, -24 * 60);
  const rangeEnd = addMinutes(endDate, 24 * 60);

  const blackouts: { date: Date }[] = await prisma.blackoutDate.findMany({
    where: {
      instructorId,
      date: { gte: rangeStart, lte: rangeEnd },
    },
  });

  const overrides: {
    date: Date;
    startTime: string | null;
    endTime: string | null;
    isAvailable: boolean;
  }[] = await prisma.scheduleOverride.findMany({
    where: {
      instructorId,
      date: { gte: rangeStart, lte: rangeEnd },
    },
  });

  // Blackouts and overrides are date-only columns standing for a whole local
  // day, so they are keyed by calendar date rather than compared as instants.
  const blackoutDates = new Set(blackouts.map((b) => calendarDateOf(b.date)));
  const overridesByDate = new Map(
    overrides.map((o) => [calendarDateOf(o.date), o])
  );

  // Step calendar dates in the school's timezone. Wall-clock strings like
  // "09:00" are converted against that date's actual UTC offset, so a 9am
  // lesson stays 9am to the caller on both sides of a DST change.
  for (const dateString of eachDateInRange(startDate, endDate)) {
    if (blackoutDates.has(dateString)) continue;

    const override = overridesByDate.get(dateString);
    if (override) {
      if (override.isAvailable && override.startTime && override.endTime) {
        result.push({
          startsAt: zonedTimeToUtc(dateString, override.startTime),
          endsAt: zonedTimeToUtc(dateString, override.endTime),
        });
      }
      continue;
    }

    const dayOfWeek = dayOfWeekFor(dateString);
    for (const window of weekly) {
      if (window.dayOfWeek !== dayOfWeek) continue;
      result.push({
        startsAt: zonedTimeToUtc(dateString, window.startTime),
        endsAt: zonedTimeToUtc(dateString, window.endTime),
      });
    }
  }

  return result;
}

export async function holdSlot(
  instructorId: string,
  startsAt: Date,
  endsAt: Date,
  customerPhone?: string,
  ttlMinutes = 5
) {
  const expiresAt = addMinutes(new Date(), ttlMinutes);
  const hold = await prisma.slotHold.create({
    data: {
      instructorId,
      startsAt,
      endsAt,
      customerPhone,
      expiresAt,
    },
  });
  return { holdId: hold.id, expiresAt };
}

export async function releaseHold(holdId: string) {
  await prisma.slotHold.deleteMany({ where: { id: holdId } });
}

export async function createBooking(input: BookingInput) {
  const instructor = await prisma.instructor.findUnique({
    where: { id: input.instructorId },
  });
  if (!instructor) throw new Error("Instructor not found");

  const endsAt =
    input.endsAt ?? addMinutes(input.startsAt, instructor.lessonDurationMinutes);

  if (endsAt <= input.startsAt) {
    throw new Error("Booking must end after it starts");
  }

  // The conflict check and the insert must be one atomic step. Previously the
  // check ran before the transaction, so two callers confirming the same slot
  // could both see it free and both commit. The database enforces this too
  // (see migrations/20260802150000_prevent_double_booking) — that constraint, not
  // this check, is what actually makes it safe under concurrency. The check
  // stays so the common case gets a readable error rather than a 23P01.
  try {
    return await prisma.$transaction(async (tx) => {
      const conflict = await tx.booking.findFirst({
        where: {
          instructorId: input.instructorId,
          status: { in: ["CONFIRMED"] },
          startsAt: { lt: endsAt },
          endsAt: { gt: input.startsAt },
        },
      });

      if (conflict) {
        throw new SlotUnavailableError();
      }

      // Consume any hold covering this slot, whoever placed it: leaving it
      // behind kept the slot looking taken until it expired.
      await tx.slotHold.deleteMany({
        where: {
          instructorId: input.instructorId,
          startsAt: { lt: endsAt },
          endsAt: { gt: input.startsAt },
        },
      });

      return tx.booking.create({
        data: {
          customerId: input.customerId,
          instructorId: input.instructorId,
          startsAt: input.startsAt,
          endsAt,
          pricePence: instructor.hourlyRatePence,
          lessonType: input.lessonType ?? "REGULAR",
          notes: input.notes,
          source: input.source ?? "PHONE_AI",
        },
        include: {
          customer: { include: { user: true } },
          instructor: { include: { user: true } },
        },
      });
    });
  } catch (error) {
    // 23P01 = exclusion_violation: the loser of a genuine race.
    if (isExclusionViolation(error)) {
      throw new SlotUnavailableError();
    }
    throw error;
  }
}

/** Thrown when the requested slot is already taken. */
export class SlotUnavailableError extends Error {
  constructor() {
    super("Selected slot is no longer available");
    this.name = "SlotUnavailableError";
  }
}

/**
 * Prisma has no mapped error code for an exclusion violation, and the shape it
 * surfaces varies by driver, so match on the SQLSTATE and the constraint name
 * wherever they appear.
 */
export function isExclusionViolation(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const haystack = [
    (error as { message?: string }).message ?? "",
    JSON.stringify((error as { meta?: unknown }).meta ?? ""),
  ].join(" ");
  return (
    haystack.includes("23P01") ||
    haystack.includes("bookings_no_overlapping_confirmed")
  );
}

export async function cancelBooking(bookingId: string, reason?: string) {
  return prisma.booking.update({
    where: { id: bookingId },
    data: {
      status: "CANCELLED",
      cancelledAt: new Date(),
      cancellationReason: reason,
    },
  });
}

export async function rescheduleBooking(
  bookingId: string,
  newStartsAt: Date,
  newEndsAt?: Date
) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { instructor: true },
  });
  if (!booking) throw new Error("Booking not found");

  const endsAt =
    newEndsAt ?? addMinutes(newStartsAt, booking.instructor.lessonDurationMinutes);

  if (endsAt <= newStartsAt) {
    throw new Error("Booking must end after it starts");
  }

  // Same race as createBooking: check and write together, and let the
  // exclusion constraint be the real arbiter.
  try {
    return await prisma.$transaction(async (tx) => {
      const conflict = await tx.booking.findFirst({
        where: {
          id: { not: bookingId },
          instructorId: booking.instructorId,
          status: { in: ["CONFIRMED"] },
          startsAt: { lt: endsAt },
          endsAt: { gt: newStartsAt },
        },
      });

      if (conflict) throw new SlotUnavailableError();

      return tx.booking.update({
        where: { id: bookingId },
        data: { startsAt: newStartsAt, endsAt },
      });
    });
  } catch (error) {
    if (isExclusionViolation(error)) throw new SlotUnavailableError();
    throw error;
  }
}
