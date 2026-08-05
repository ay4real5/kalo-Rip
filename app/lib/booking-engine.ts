import { prisma } from "@/app/lib/prisma";
import { addMinutes, areIntervalsOverlapping } from "date-fns";
import {
  calendarDateOf,
  dayOfWeekFor,
  eachDateInRange,
  nextDate,
  startOfLocalDay,
  zonedDateString,
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

/**
 * Does a proposed lesson clash with one already in the diary?
 *
 * `bufferMinutes` is the instructor's travel time between pupils. An existing
 * lesson blocks its own slot plus that much either side, because the
 * instructor has to physically get there. The field was collected in the
 * portal and saved to the database but never read, so lessons were sold
 * back-to-back across town with no travel time at all.
 *
 * Half-open [start, end), matching the database exclusion constraint: with a
 * zero buffer, a lesson ending at 10:00 does not clash with one starting then.
 */
function clashesWith(
  proposed: { startsAt: Date; endsAt: Date },
  existing: { startsAt: Date; endsAt: Date },
  bufferMinutes: number
): boolean {
  return areIntervalsOverlapping(
    {
      start: addMinutes(existing.startsAt, -bufferMinutes),
      end: addMinutes(existing.endsAt, bufferMinutes),
    },
    { start: proposed.startsAt, end: proposed.endsAt }
  );
}

/** Confirmed lessons per local calendar date. */
function countByLocalDate(bookings: { startsAt: Date }[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const booking of bookings) {
    const date = zonedDateString(booking.startsAt);
    counts.set(date, (counts.get(date) ?? 0) + 1);
  }
  return counts;
}

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

    const bufferMinutes = instructor.travelBufferMinutes ?? 0;
    const dailyCount = countByLocalDate(existingBookings);
    const maxPerDay = instructor.maxLessonsPerDay ?? Infinity;

    for (const range of availability) {
      const lessonMinutes = instructor.lessonDurationMinutes ?? DEFAULT_LESSON_MINUTES;

      // An instructor who caps their day at 4 lessons and already has 4 is
      // full, however much availability the pattern says they have. This cap
      // was configurable in the portal but never enforced.
      if ((dailyCount.get(zonedDateString(range.startsAt)) ?? 0) >= maxPerDay) {
        continue;
      }

      let cursor = range.startsAt;
      while (addMinutes(cursor, lessonMinutes) <= range.endsAt) {
        const endsAt = addMinutes(cursor, lessonMinutes);
        const proposed = { startsAt: cursor, endsAt };

        const isBooked = existingBookings.some((b) =>
          clashesWith(proposed, b, bufferMinutes)
        );
        // Holds are a short-lived "someone is confirming this" marker, so they
        // block only their own slot — no travel buffer around them.
        const isHeld = holds.some((h) => clashesWith(proposed, h, 0));

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

/**
 * Check whether any active instructor covers the given postcode area,
 * regardless of transmission. Used by the voice agent to distinguish
 * "we don't cover your area" from "fully booked" — without this, an
 * empty slot search returns no reason and the agent tells the caller
 * there are no slots at all, losing the lead.
 *
 * Returns the list of outcodes the school currently serves, so the agent
 * can suggest the nearest covered area.
 */
export async function checkAreaCoverage(postcode: string): Promise<{
  covered: boolean;
  servedAreas: string[];
}> {
  const cleanedPostcode = postcode.replace(/\s+/g, " ").trim().toUpperCase();
  const outcode = cleanedPostcode.split(" ")[0];

  const instructors = await prisma.instructor.findMany({
    where: { active: true, acceptsNewLearners: true },
    select: { servicePostcodes: true },
  });

  const servedAreas = [...new Set(instructors.flatMap((i) => i.servicePostcodes))].sort();
  const covered = servedAreas.includes(outcode);

  return { covered, servedAreas };
}

/** A time the school can honour, without saying who will teach it. */
export interface CapacitySlot {
  startsAt: Date;
  endsAt: Date;
  pricePence: number;
  /** How many eligible drivers are free then. Never exposed to the caller. */
  freeInstructors: number;
}

/**
 * Times the school can commit to, aggregated across every eligible driver.
 *
 * The phone agent secures a *time* and an admin picks the driver afterwards,
 * so the caller must never be offered a named instructor's diary. What matters
 * is whether at least one driver who covers their area could take it.
 *
 * Bookings already secured but not yet assigned count against capacity. Without
 * that the agent would happily sell 09:00 to five learners when only two
 * drivers are free, and the admin would be left unable to honour three of them.
 */
export async function searchSchoolCapacity(
  input: SearchSlotInput
): Promise<CapacitySlot[]> {
  const startDate =
    input.startDate ?? input.preferredDate ?? startOfLocalDay(new Date());
  const endDate =
    input.endDate ?? addMinutes(startOfLocalDay(startDate), 15 * 24 * 60);

  // Per-instructor availability, reusing the same rules as the direct search:
  // areas, transmission, working hours, blackouts, buffers and daily caps.
  const perInstructor = await searchAvailableSlots({
    ...input,
    startDate,
    endDate,
  });

  // Lessons whose time is sold but whose driver is still to be decided.
  const unassigned = await prisma.booking.findMany({
    where: {
      instructorId: null,
      status: { in: ["PENDING_ASSIGNMENT"] },
      startsAt: { lt: endDate },
      endsAt: { gt: startDate },
    },
    select: { startsAt: true, endsAt: true },
  });

  const byTime = new Map<string, CapacitySlot>();
  for (const slot of perInstructor) {
    const key = `${slot.startsAt.toISOString()}|${slot.endsAt.toISOString()}`;
    const existing = byTime.get(key);
    if (existing) {
      existing.freeInstructors += 1;
      existing.pricePence = Math.min(existing.pricePence, slot.pricePence);
      continue;
    }
    byTime.set(key, {
      startsAt: slot.startsAt,
      endsAt: slot.endsAt,
      pricePence: slot.pricePence,
      freeInstructors: 1,
    });
  }

  // Spend capacity on anything already promised at that time.
  for (const booking of unassigned) {
    for (const slot of byTime.values()) {
      if (
        booking.startsAt < slot.endsAt &&
        booking.endsAt > slot.startsAt
      ) {
        slot.freeInstructors -= 1;
      }
    }
  }

  return [...byTime.values()]
    .filter((s) => s.freeInstructors > 0)
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
    .slice(0, 20);
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
  if (endsAt <= startsAt) {
    throw new Error("Hold must end after it starts");
  }

  assertBookableDate(startsAt);

  // A hold used to be written for any time at all, so the agent could reserve
  // — and then confirm — a slot that was already booked or outside working
  // hours. Validate before reserving.
  const instructor = await prisma.instructor.findUnique({
    where: { id: instructorId },
    select: { travelBufferMinutes: true },
  });
  if (!instructor) throw new Error("Instructor not found");

  if (!(await isWithinAvailability(instructorId, startsAt, endsAt))) {
    throw new OutsideAvailabilityError();
  }

  const buffer = instructor.travelBufferMinutes ?? 0;
  const conflict = await prisma.booking.findFirst({
    where: {
      instructorId,
      status: { in: ["CONFIRMED"] },
      startsAt: { lt: addMinutes(endsAt, buffer) },
      endsAt: { gt: addMinutes(startsAt, -buffer) },
    },
  });
  if (conflict) throw new SlotUnavailableError();

  const existingHold = await prisma.slotHold.findFirst({
    where: {
      instructorId,
      expiresAt: { gt: new Date() },
      startsAt: { lt: endsAt },
      endsAt: { gt: startsAt },
    },
  });
  if (existingHold) throw new SlotUnavailableError();

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

  assertBookableDate(input.startsAt);

  // The conflict check and the insert must be one atomic step. Previously the
  // check ran before the transaction, so two callers confirming the same slot
  // could both see it free and both commit. The database enforces this too
  // (see migrations/20260802150000_prevent_double_booking) — that constraint, not
  // this check, is what actually makes it safe under concurrency. The check
  // stays so the common case gets a readable error rather than a 23P01.
  const buffer = instructor.travelBufferMinutes ?? 0;

  try {
    return await prisma.$transaction(async (tx) => {
      // Widen the conflict window by the travel buffer so a booking made
      // directly — by an admin, or by the voice agent against a stale slot
      // list — can't land tighter than the instructor can actually travel.
      const conflict = await tx.booking.findFirst({
        where: {
          instructorId: input.instructorId,
          status: { in: ["CONFIRMED"] },
          startsAt: { lt: addMinutes(endsAt, buffer) },
          endsAt: { gt: addMinutes(input.startsAt, -buffer) },
        },
      });

      if (conflict) {
        throw new SlotUnavailableError();
      }

      if (instructor.maxLessonsPerDay) {
        const localDate = zonedDateString(input.startsAt);
        const dayCount = await tx.booking.count({
          where: {
            instructorId: input.instructorId,
            status: { in: ["CONFIRMED"] },
            startsAt: {
              gte: zonedTimeToUtc(localDate, "00:00"),
              lt: zonedTimeToUtc(nextDate(localDate), "00:00"),
            },
          },
        });
        if (dayCount >= instructor.maxLessonsPerDay) {
          throw new DailyLimitReachedError();
        }
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

/** Thrown when the instructor has hit their self-imposed lessons-per-day cap. */
export class DailyLimitReachedError extends Error {
  constructor() {
    super("Instructor is fully booked that day");
    this.name = "DailyLimitReachedError";
  }
}

/** Thrown when a time falls outside the instructor's working hours. */
export class OutsideAvailabilityError extends Error {
  constructor() {
    super("That time is outside the instructor's working hours");
    this.name = "OutsideAvailabilityError";
  }
}

/** Thrown for a lesson time in the past, or absurdly far ahead. */
export class InvalidLessonDateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidLessonDateError";
  }
}

/** How far ahead a lesson may be booked. */
const MAX_BOOKING_HORIZON_DAYS = 180;

/**
 * Reject lesson times that cannot be real.
 *
 * The voice agent is told only to offer slots the search returned, but a
 * language model will still occasionally produce a date of its own: a live
 * test booked a lesson for 30 October *2023*, a date never offered, which
 * passed every other check because it happened to be a Monday and the
 * instructor works Mondays. Availability and conflict checks say nothing about
 * whether a date is plausible, so this does.
 */
function assertBookableDate(startsAt: Date) {
  if (Number.isNaN(startsAt.getTime())) {
    throw new InvalidLessonDateError("That date could not be understood");
  }
  if (startsAt.getTime() <= Date.now()) {
    throw new InvalidLessonDateError("Lessons cannot be booked in the past");
  }
  const horizon = addMinutes(new Date(), MAX_BOOKING_HORIZON_DAYS * 24 * 60);
  if (startsAt > horizon) {
    throw new InvalidLessonDateError(
      `Lessons cannot be booked more than ${MAX_BOOKING_HORIZON_DAYS} days ahead`
    );
  }
}

/**
 * Is this window inside the instructor's actual working hours, accounting for
 * blackouts and one-off overrides?
 *
 * Slot search only ever proposes times from the availability pattern, but
 * holds and reschedules took a time and used it, so a lesson could be moved to
 * 3am on a day the instructor was on leave.
 */
export async function isWithinAvailability(
  instructorId: string,
  startsAt: Date,
  endsAt: Date
): Promise<boolean> {
  const windows = await getInstructorAvailability(
    instructorId,
    startOfLocalDay(startsAt),
    addMinutes(startOfLocalDay(endsAt), 24 * 60)
  );
  return windows.some(
    (w) => startsAt >= w.startsAt && endsAt <= w.endsAt
  );
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

export interface SecureSlotInput {
  customerId: string;
  postcode: string;
  transmission?: "MANUAL" | "AUTOMATIC" | "BOTH";
  startsAt: Date;
  endsAt?: Date;
  lessonType?: "REGULAR" | "INTENSIVE" | "TEST" | "REFRESHER";
  notes?: string;
  source?: "PHONE_AI" | "PORTAL" | "ADMIN";
}

/**
 * Secure a time for a learner without choosing a driver.
 *
 * This is what the phone agent and the booking form now do. The learner gets a
 * real, held time; an admin assigns the driver afterwards. Nothing is promised
 * that cannot be delivered: the slot must still have a genuinely free,
 * eligible driver at the moment of booking, counting lessons already secured
 * but not yet assigned.
 */
export async function securePendingBooking(input: SecureSlotInput) {
  assertBookableDate(input.startsAt);

  const capacity = await searchSchoolCapacity({
    postcode: input.postcode,
    transmission: input.transmission,
    lessonType: input.lessonType,
    startDate: startOfLocalDay(input.startsAt),
    endDate: addMinutes(startOfLocalDay(input.startsAt), 24 * 60),
  });

  const match = capacity.find(
    (slot) => slot.startsAt.getTime() === input.startsAt.getTime()
  );
  if (!match) {
    throw new SlotUnavailableError();
  }

  const endsAt = input.endsAt ?? match.endsAt;
  if (endsAt <= input.startsAt) {
    throw new Error("Booking must end after it starts");
  }

  return prisma.booking.create({
    data: {
      customerId: input.customerId,
      instructorId: null,
      startsAt: input.startsAt,
      endsAt,
      status: "PENDING_ASSIGNMENT",
      pricePence: match.pricePence,
      lessonType: input.lessonType ?? "REGULAR",
      notes: input.notes,
      source: input.source ?? "PHONE_AI",
    },
    include: { customer: { include: { user: true } } },
  });
}

/** Drivers who could actually take an unassigned lesson. */
export async function eligibleInstructorsFor(bookingId: string) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { customer: true },
  });
  if (!booking) throw new Error("Booking not found");

  const candidates = await searchAvailableSlots({
    postcode: booking.customer.postcode,
    transmission: booking.customer.transmission,
    lessonType: booking.lessonType,
    startDate: startOfLocalDay(booking.startsAt),
    endDate: addMinutes(startOfLocalDay(booking.startsAt), 24 * 60),
  });

  // Only those free at exactly this time. searchAvailableSlots has already
  // applied areas, transmission, working hours, blackouts, travel buffers and
  // daily caps, so anything left here is genuinely assignable.
  const free = candidates.filter(
    (slot) => slot.startsAt.getTime() === booking.startsAt.getTime()
  );

  return free.map((slot) => ({
    instructorId: slot.instructorId,
    instructorName: slot.instructorName,
    pricePence: slot.pricePence,
    vehicleType: slot.vehicleType,
  }));
}

/**
 * Give an unassigned lesson to a driver.
 *
 * The exclusion constraint is the real guard here: two admins assigning the
 * same driver to overlapping lessons at once cannot both win, whatever this
 * check says.
 */
export async function assignInstructor(bookingId: string, instructorId: string) {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking) throw new Error("Booking not found");
  if (booking.status === "CANCELLED") {
    throw new Error("Cannot assign a cancelled booking");
  }

  const instructor = await prisma.instructor.findUnique({
    where: { id: instructorId },
  });
  if (!instructor) throw new Error("Instructor not found");

  if (!(await isWithinAvailability(instructorId, booking.startsAt, booking.endsAt))) {
    throw new OutsideAvailabilityError();
  }

  const buffer = instructor.travelBufferMinutes ?? 0;

  try {
    return await prisma.$transaction(async (tx) => {
      const clash = await tx.booking.findFirst({
        where: {
          id: { not: bookingId },
          instructorId,
          status: { in: ["CONFIRMED"] },
          startsAt: { lt: addMinutes(booking.endsAt, buffer) },
          endsAt: { gt: addMinutes(booking.startsAt, -buffer) },
        },
      });
      if (clash) throw new SlotUnavailableError();

      return tx.booking.update({
        where: { id: bookingId },
        data: {
          instructorId,
          status: "CONFIRMED",
          assignedAt: new Date(),
        },
        include: {
          customer: { include: { user: true } },
          instructor: { include: { user: true } },
        },
      });
    });
  } catch (error) {
    if (isExclusionViolation(error)) throw new SlotUnavailableError();
    throw error;
  }
}

export async function cancelBooking(bookingId: string, reason?: string) {
  const booking = await prisma.booking.update({
    where: { id: bookingId },
    data: {
      status: "CANCELLED",
      cancelledAt: new Date(),
      cancellationReason: reason,
    },
  });

  // Offer the freed slot to anyone waiting for it. Best-effort and never
  // allowed to fail the cancellation itself — notifyWaitlistForSlot swallows
  // its own errors, and this only fires for lessons still in the future.
  // An unassigned lesson was never on a driver's diary, so cancelling it frees
  // nothing for the waitlist to claim.
  if (booking.startsAt > new Date() && booking.instructorId) {
    const { notifyWaitlistForSlot } = await import("@/app/lib/waitlist");
    await notifyWaitlistForSlot({
      instructorId: booking.instructorId,
      startsAt: booking.startsAt,
      endsAt: booking.endsAt,
    });
  }

  return booking;
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

  const lessonMinutes =
    booking.instructor?.lessonDurationMinutes ??
    Math.round((booking.endsAt.getTime() - booking.startsAt.getTime()) / 60000);
  const endsAt = newEndsAt ?? addMinutes(newStartsAt, lessonMinutes);

  if (endsAt <= newStartsAt) {
    throw new Error("Booking must end after it starts");
  }

  assertBookableDate(newStartsAt);

  // An unassigned lesson has no working hours to respect yet — the driver who
  // ends up with it is chosen later, and assignInstructor re-checks then. Only
  // validate against a diary once there is one.
  if (booking.instructorId) {
    // Rescheduling only checked for a clashing booking, so a lesson could be
    // moved to 3am, or onto a day the instructor had blacked out.
    if (!(await isWithinAvailability(booking.instructorId, newStartsAt, endsAt))) {
      throw new OutsideAvailabilityError();
    }
  }

  const buffer = booking.instructor?.travelBufferMinutes ?? 0;

  // Same race as createBooking: check and write together, and let the
  // exclusion constraint be the real arbiter.
  try {
    return await prisma.$transaction(async (tx) => {
      // Only meaningful once a driver owns the lesson. Querying with a null
      // instructorId would match every *other* unassigned booking and report
      // them as clashes, which they are not — nobody is double-booked.
      const conflict = booking.instructorId
        ? await tx.booking.findFirst({
            where: {
              id: { not: bookingId },
              instructorId: booking.instructorId,
              status: { in: ["CONFIRMED"] },
              startsAt: { lt: addMinutes(endsAt, buffer) },
              endsAt: { gt: addMinutes(newStartsAt, -buffer) },
            },
          })
        : null;

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
