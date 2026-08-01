import { prisma } from "@/app/lib/prisma";
import {
  addMinutes,
  areIntervalsOverlapping,
  endOfDay,
  format,
  isSameDay,
  startOfDay,
} from "date-fns";
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
  const startDate = input.startDate ?? input.preferredDate ?? startOfDay(new Date());
  const endDate = input.endDate ?? addMinutes(endOfDay(startDate), 14 * 24 * 60); // 2 weeks ahead

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
    const existingBookings: BookingRecord[] = await prisma.booking.findMany({
      where: {
        instructorId: instructor.id,
        status: { in: ["CONFIRMED"] },
        startsAt: { gte: startDate, lte: endDate },
      },
    });

    const holds: HoldRecord[] = await prisma.slotHold.findMany({
      where: {
        instructorId: instructor.id,
        expiresAt: { gt: new Date() },
        startsAt: { gte: startDate, lte: endDate },
      },
    });

    for (const range of availability) {
      const lessonMinutes = instructor.lessonDurationMinutes ?? DEFAULT_LESSON_MINUTES;
      let cursor = range.startsAt;
      while (addMinutes(cursor, lessonMinutes) <= range.endsAt) {
        const endsAt = addMinutes(cursor, lessonMinutes);
        const proposed = { startsAt: cursor, endsAt };

        const isBooked = existingBookings.some((b) =>
          areIntervalsOverlapping(
            { start: b.startsAt, end: b.endsAt },
            { start: proposed.startsAt, end: proposed.endsAt },
            { inclusive: true }
          )
        );

        const isHeld = holds.some((h) =>
          areIntervalsOverlapping(
            { start: h.startsAt, end: h.endsAt },
            { start: proposed.startsAt, end: proposed.endsAt },
            { inclusive: true }
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

  const blackouts: { date: Date }[] = await prisma.blackoutDate.findMany({
    where: {
      instructorId,
      date: { gte: startDate, lte: endDate },
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
      date: { gte: startDate, lte: endDate },
    },
  });

  let cursor = startOfDay(startDate);
  while (cursor <= endDate) {
    const dateBlackout = blackouts.some((b) => isSameDay(b.date, cursor));
    if (!dateBlackout) {
      const override = overrides.find((o) => isSameDay(o.date, cursor));
      const dayOfWeek = cursor.getDay();
      const dateString = format(cursor, "yyyy-MM-dd");

      if (override) {
        if (override.isAvailable && override.startTime && override.endTime) {
          result.push({
            startsAt: new Date(`${dateString}T${override.startTime}`),
            endsAt: new Date(`${dateString}T${override.endTime}`),
          });
        }
      } else {
        for (const window of weekly) {
          if (window.dayOfWeek !== dayOfWeek) continue;
          result.push({
            startsAt: new Date(`${dateString}T${window.startTime}`),
            endsAt: new Date(`${dateString}T${window.endTime}`),
          });
        }
      }
    }
    cursor = addMinutes(cursor, 24 * 60);
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

  const existingBooking = await prisma.booking.findFirst({
    where: {
      instructorId: input.instructorId,
      status: { in: ["CONFIRMED"] },
      OR: [
        {
          startsAt: { lt: endsAt },
          endsAt: { gt: input.startsAt },
        },
      ],
    },
  });

  if (existingBooking) {
    throw new Error("Selected slot is no longer available");
  }

  const activeHold = await prisma.slotHold.findFirst({
    where: {
      instructorId: input.instructorId,
      startsAt: input.startsAt,
      endsAt,
      expiresAt: { gt: new Date() },
    },
  });

  const booking = await prisma.$transaction(async (tx) => {
    if (activeHold) {
      await tx.slotHold.deleteMany({ where: { id: activeHold.id } });
    }
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

  return booking;
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

  const conflict = await prisma.booking.findFirst({
    where: {
      id: { not: bookingId },
      instructorId: booking.instructorId,
      status: { in: ["CONFIRMED"] },
      startsAt: { lt: endsAt },
      endsAt: { gt: newStartsAt },
    },
  });

  if (conflict) throw new Error("New slot is unavailable");

  return prisma.booking.update({
    where: { id: bookingId },
    data: { startsAt: newStartsAt, endsAt },
  });
}
