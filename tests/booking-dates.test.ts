import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Lesson dates must be plausible, whoever supplied them.
 *
 * Found by a live call: the voice agent produced a slot that was never in the
 * search results and the system booked a lesson for 30 October *2023*. It
 * passed every existing check — that date is a Monday and the instructor works
 * Mondays, so the availability and conflict rules had nothing to say about it.
 * An LLM's date is untrusted input.
 */

const instructor = {
  id: "inst-1",
  lessonDurationMinutes: 60,
  hourlyRatePence: 3500,
  travelBufferMinutes: 0,
  maxLessonsPerDay: null,
};

vi.mock("@/app/lib/prisma", () => ({
  prisma: {
    instructor: { findUnique: async () => instructor },
    booking: { findFirst: async () => null, findMany: async () => [], count: async () => 0 },
    slotHold: { findFirst: async () => null, findMany: async () => [], create: async () => ({ id: "h1" }) },
    availability: { findMany: async () => [] },
    blackoutDate: { findMany: async () => [] },
    scheduleOverride: { findMany: async () => [] },
    $transaction: async (fn: (tx: unknown) => unknown) => fn({}),
  },
}));

const { createBooking, holdSlot, InvalidLessonDateError } = await import(
  "@/app/lib/booking-engine"
);

const hourAfter = (d: Date) => new Date(d.getTime() + 3600_000);

function bookingAt(startsAt: Date) {
  return createBooking({
    customerId: "cust-1",
    instructorId: "inst-1",
    startsAt,
    endsAt: hourAfter(startsAt),
  });
}

beforeEach(() => {
  vi.useRealTimers();
});

describe("lesson date validation", () => {
  it("refuses a lesson in the past", async () => {
    const lastYear = new Date(Date.now() - 365 * 24 * 3600_000);
    await expect(bookingAt(lastYear)).rejects.toBeInstanceOf(InvalidLessonDateError);
  });

  it("refuses the exact date the live call hallucinated", async () => {
    await expect(bookingAt(new Date("2023-10-30T09:00:00.000Z"))).rejects.toThrow(
      /past/i
    );
  });

  it("refuses a lesson absurdly far ahead", async () => {
    const farFuture = new Date(Date.now() + 400 * 24 * 3600_000);
    await expect(bookingAt(farFuture)).rejects.toThrow(/ahead/i);
  });

  it("refuses an unparseable date", async () => {
    await expect(bookingAt(new Date("not-a-date"))).rejects.toBeInstanceOf(
      InvalidLessonDateError
    );
  });

  it("refuses a hold in the past too", async () => {
    const yesterday = new Date(Date.now() - 24 * 3600_000);
    await expect(
      holdSlot("inst-1", yesterday, hourAfter(yesterday))
    ).rejects.toBeInstanceOf(InvalidLessonDateError);
  });

  it("still rejects a zero-length or reversed booking", async () => {
    const soon = new Date(Date.now() + 3600_000);
    await expect(
      createBooking({
        customerId: "c",
        instructorId: "inst-1",
        startsAt: soon,
        endsAt: soon,
      })
    ).rejects.toThrow(/end after it starts/i);
  });

  it("lets a plausible near-future date through the date check", async () => {
    // No availability is stubbed, so this must fail on availability rather
    // than on the date — proving the date gate itself passed.
    const nextWeek = new Date(Date.now() + 7 * 24 * 3600_000);
    await expect(
      holdSlot("inst-1", nextWeek, hourAfter(nextWeek))
    ).rejects.not.toBeInstanceOf(InvalidLessonDateError);
  });
});
