import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The AI secures the time; an admin picks the driver.
 *
 * The risk this model introduces is overselling: a lesson booked with nobody
 * attached looks free to the next caller, so the school can promise more 9am
 * lessons than it has drivers and be unable to honour them. Capacity therefore
 * has to account for lessons already secured but not yet assigned.
 */

type Row = Record<string, unknown>;

const db = {
  instructor: [] as Row[],
  availability: [] as Row[],
  booking: [] as Row[],
  slotHold: [] as Row[],
  blackoutDate: [] as Row[],
  scheduleOverride: [] as Row[],
};

/** Bookings the capacity query should see: unassigned and pending. */
function unassigned() {
  return db.booking.filter((b) => b.instructorId === null);
}

vi.mock("@/app/lib/prisma", () => ({
  prisma: {
    instructor: {
      // Honour the postcode filter — the engine relies on the database to do
      // area matching, so a stub that ignores it would hide real behaviour.
      findMany: async (args?: { where?: { servicePostcodes?: { has?: string } } }) => {
        const outcode = args?.where?.servicePostcodes?.has;
        if (!outcode) return db.instructor;
        return db.instructor.filter((i) =>
          (i.servicePostcodes as string[]).includes(outcode)
        );
      },
    },
    // Scoped per instructor. Returning every instructor's hours to each of
    // them double-counted capacity and made two drivers look like four.
    availability: {
      findMany: async (args?: { where?: { instructorId?: string } }) =>
        db.availability.filter(
          (a) => !args?.where?.instructorId || a.instructorId === args.where.instructorId
        ),
    },
    booking: {
      findMany: async (args?: { where?: Row }) =>
        args?.where && "instructorId" in args.where && args.where.instructorId === null
          ? unassigned()
          : db.booking.filter((b) => b.instructorId !== null),
    },
    slotHold: { findMany: async () => db.slotHold },
    blackoutDate: { findMany: async () => db.blackoutDate },
    scheduleOverride: { findMany: async () => db.scheduleOverride },
  },
}));

const { searchSchoolCapacity } = await import("@/app/lib/booking-engine");

const SUMMER_WED = "2026-08-05";

function instructor(id: string, over: Row = {}) {
  return {
    id,
    active: true,
    acceptsNewLearners: true,
    offersIntensive: false,
    transmission: "AUTOMATIC",
    lessonDurationMinutes: 60,
    travelBufferMinutes: 0,
    maxLessonsPerDay: null,
    hourlyRatePence: 3500,
    vehicleType: "Corsa",
    basePostcode: "CR0 1AA",
    servicePostcodes: ["CR0"],
    user: { name: `Driver ${id}` },
    ...over,
  };
}

function search() {
  return searchSchoolCapacity({
    postcode: "CR0 1AA",
    transmission: "AUTOMATIC",
    startDate: new Date(`${SUMMER_WED}T00:00:00.000Z`),
    endDate: new Date(`${SUMMER_WED}T23:59:59.000Z`),
  });
}

beforeEach(() => {
  db.instructor = [instructor("inst-1"), instructor("inst-2")];
  db.availability = [
    { instructorId: "inst-1", dayOfWeek: 3, startTime: "09:00", endTime: "11:00" },
    { instructorId: "inst-2", dayOfWeek: 3, startTime: "09:00", endTime: "11:00" },
  ];
  db.booking = [];
  db.slotHold = [];
  db.blackoutDate = [];
  db.scheduleOverride = [];
});

describe("searchSchoolCapacity", () => {
  it("offers each time once, however many drivers are free", async () => {
    // The caller is picking a time, not a person. Two drivers free at 09:00 is
    // one option to offer, not two.
    const slots = await search();
    expect(slots).toHaveLength(2); // 09:00 and 10:00 UK
    expect(slots[0].freeInstructors).toBe(2);
  });

  it("counts a secured but unassigned lesson against capacity", async () => {
    db.booking = [
      {
        id: "b1",
        instructorId: null,
        status: "PENDING_ASSIGNMENT",
        startsAt: new Date(`${SUMMER_WED}T08:00:00.000Z`), // 09:00 UK
        endsAt: new Date(`${SUMMER_WED}T09:00:00.000Z`),
      },
    ];
    const slots = await search();
    const nine = slots.find(
      (s) => s.startsAt.toISOString() === `${SUMMER_WED}T08:00:00.000Z`
    );
    // One of the two drivers is now spoken for, even though nobody has been
    // told which one.
    expect(nine?.freeInstructors).toBe(1);
  });

  it("stops offering a time once every driver is spoken for", async () => {
    // This is the overselling guard. Without it the school would keep taking
    // 09:00 bookings it cannot staff.
    db.booking = [
      {
        id: "b1",
        instructorId: null,
        status: "PENDING_ASSIGNMENT",
        startsAt: new Date(`${SUMMER_WED}T08:00:00.000Z`),
        endsAt: new Date(`${SUMMER_WED}T09:00:00.000Z`),
      },
      {
        id: "b2",
        instructorId: null,
        status: "PENDING_ASSIGNMENT",
        startsAt: new Date(`${SUMMER_WED}T08:00:00.000Z`),
        endsAt: new Date(`${SUMMER_WED}T09:00:00.000Z`),
      },
    ];
    const slots = await search();
    expect(
      slots.some((s) => s.startsAt.toISOString() === `${SUMMER_WED}T08:00:00.000Z`)
    ).toBe(false);
    // The 10:00 slot is untouched.
    expect(slots).toHaveLength(1);
  });

  it("never names an instructor in the result", async () => {
    // The caller must not be told who will teach it — nobody has decided yet.
    const slots = await search();
    for (const slot of slots) {
      expect(Object.keys(slot)).not.toContain("instructorId");
      expect(Object.keys(slot)).not.toContain("instructorName");
    }
  });

  it("quotes the cheapest driver's price for a shared time", async () => {
    db.instructor = [
      instructor("inst-1", { hourlyRatePence: 4200 }),
      instructor("inst-2", { hourlyRatePence: 3500 }),
    ];
    const slots = await search();
    expect(slots[0].pricePence).toBe(3500);
  });

  it("returns nothing when no driver covers the area", async () => {
    db.instructor = [instructor("inst-1", { servicePostcodes: ["SE25"] })];
    db.availability = [
      { instructorId: "inst-1", dayOfWeek: 3, startTime: "09:00", endTime: "11:00" },
    ];
    expect(await search()).toHaveLength(0);
  });
});
