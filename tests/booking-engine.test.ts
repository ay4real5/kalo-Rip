import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Slot generation against a stubbed Prisma, so these run with no database.
 *
 * The stub is deliberately dumb: it returns whatever `db` holds for each model
 * and ignores the `where` clause. That is enough for the questions these tests
 * ask, which are all about how availability windows are turned into slots, and
 * it keeps them from silently depending on query semantics.
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

/** Last `where` clause each model was queried with. */
const lastWhere: Record<string, Row> = {};

function model(name: keyof typeof db) {
  return {
    findMany: async (args?: { where?: Row }) => {
      lastWhere[name] = args?.where ?? {};
      return db[name];
    },
  };
}

vi.mock("@/app/lib/prisma", () => ({
  prisma: {
    instructor: model("instructor"),
    availability: model("availability"),
    booking: model("booking"),
    slotHold: model("slotHold"),
    blackoutDate: model("blackoutDate"),
    scheduleOverride: model("scheduleOverride"),
  },
}));

const { searchAvailableSlots } = await import("@/app/lib/booking-engine");

const INSTRUCTOR = {
  id: "inst-1",
  active: true,
  acceptsNewLearners: true,
  offersIntensive: false,
  transmission: "MANUAL",
  lessonDurationMinutes: 60,
  hourlyRatePence: 3500,
  vehicleType: "Corsa",
  basePostcode: "CR0 1AA",
  servicePostcodes: ["CR0"],
  user: { name: "Sam" },
};

// A Wednesday in BST and a Wednesday in GMT.
const SUMMER_WED = "2026-08-05";
const WINTER_WED = "2026-01-07";

function reset() {
  db.instructor = [{ ...INSTRUCTOR }];
  db.availability = [{ instructorId: "inst-1", dayOfWeek: 3, startTime: "09:00", endTime: "12:00" }];
  db.booking = [];
  db.slotHold = [];
  db.blackoutDate = [];
  db.scheduleOverride = [];
}

/** Search a single local day. */
function searchDay(date: string) {
  return searchAvailableSlots({
    postcode: "CR0 1AA",
    transmission: "MANUAL",
    startDate: new Date(`${date}T00:00:00.000Z`),
    endDate: new Date(`${date}T23:59:59.000Z`),
  });
}

beforeEach(reset);

describe("searchAvailableSlots — timezone", () => {
  it("offers a 9am BST window as 08:00Z, not 09:00Z", async () => {
    // Under the old code this returned 09:00Z, i.e. 10am to the caller.
    const slots = await searchDay(SUMMER_WED);
    expect(slots).toHaveLength(3);
    expect(slots[0].startsAt.toISOString()).toBe(`${SUMMER_WED}T08:00:00.000Z`);
    expect(slots.at(-1)!.endsAt.toISOString()).toBe(`${SUMMER_WED}T11:00:00.000Z`);
  });

  it("offers the same 9am window as 09:00Z in winter", async () => {
    const slots = await searchDay(WINTER_WED);
    expect(slots).toHaveLength(3);
    expect(slots[0].startsAt.toISOString()).toBe(`${WINTER_WED}T09:00:00.000Z`);
  });

  it("presents the same wall-clock start on both sides of a DST change", async () => {
    const format = (d: Date) =>
      new Intl.DateTimeFormat("en-GB", {
        timeZone: "Europe/London",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(d);

    const summer = await searchDay(SUMMER_WED);
    const winter = await searchDay(WINTER_WED);

    // This is the property that actually matters to a caller: 9am is 9am.
    expect(format(summer[0].startsAt)).toBe("09:00");
    expect(format(winter[0].startsAt)).toBe("09:00");
  });

  it("splits a window into whole lessons and drops the remainder", async () => {
    db.availability = [
      { instructorId: "inst-1", dayOfWeek: 3, startTime: "09:00", endTime: "10:30" },
    ];
    const slots = await searchDay(SUMMER_WED);
    expect(slots).toHaveLength(1); // 09:00-10:00; the last 30 min can't hold a lesson
  });

  it("honours a non-default lesson duration", async () => {
    db.instructor = [{ ...INSTRUCTOR, lessonDurationMinutes: 90 }];
    const slots = await searchDay(SUMMER_WED);
    expect(slots).toHaveLength(2); // 09:00 and 10:30 within a 3h window
  });
});

describe("searchAvailableSlots — exclusions", () => {
  it("excludes a slot that is already booked", async () => {
    db.booking = [
      {
        id: "b1",
        startsAt: new Date(`${SUMMER_WED}T09:00:00.000Z`), // 10:00 UK
        endsAt: new Date(`${SUMMER_WED}T10:00:00.000Z`),
        status: "CONFIRMED",
      },
    ];
    const slots = await searchDay(SUMMER_WED);
    expect(slots.map((s) => s.startsAt.toISOString())).toEqual([
      `${SUMMER_WED}T08:00:00.000Z`,
      `${SUMMER_WED}T10:00:00.000Z`,
    ]);
  });

  it("still offers the slots either side of a booking", async () => {
    // Regression: overlap was tested inclusively, so a 10:00-11:00 lesson also
    // blocked 09:00-10:00 and 11:00-12:00 — one booking cost three hours of
    // diary and back-to-back lessons were never offered.
    db.availability = [
      { instructorId: "inst-1", dayOfWeek: 3, startTime: "09:00", endTime: "13:00" },
    ];
    db.booking = [
      {
        id: "b1",
        startsAt: new Date(`${SUMMER_WED}T09:00:00.000Z`), // 10:00-11:00 UK
        endsAt: new Date(`${SUMMER_WED}T10:00:00.000Z`),
        status: "CONFIRMED",
      },
    ];
    const slots = await searchDay(SUMMER_WED);
    expect(slots.map((s) => s.startsAt.toISOString())).toEqual([
      `${SUMMER_WED}T08:00:00.000Z`, // 09:00 UK, ends exactly as the lesson starts
      `${SUMMER_WED}T10:00:00.000Z`, // 11:00 UK, starts exactly as it ends
      `${SUMMER_WED}T11:00:00.000Z`,
    ]);
  });

  it("excludes a slot held by another caller", async () => {
    db.slotHold = [
      {
        id: "h1",
        startsAt: new Date(`${SUMMER_WED}T08:00:00.000Z`),
        endsAt: new Date(`${SUMMER_WED}T09:00:00.000Z`),
        expiresAt: new Date(Date.now() + 5 * 60_000),
      },
    ];
    const slots = await searchDay(SUMMER_WED);
    expect(slots.map((s) => s.startsAt.toISOString())).not.toContain(
      `${SUMMER_WED}T08:00:00.000Z`
    );
  });

  it("returns nothing on a blackout day", async () => {
    db.blackoutDate = [{ date: new Date(`${SUMMER_WED}T00:00:00.000Z`) }];
    expect(await searchDay(SUMMER_WED)).toHaveLength(0);
  });

  it("lets an override replace the weekly pattern", async () => {
    db.scheduleOverride = [
      {
        date: new Date(`${SUMMER_WED}T00:00:00.000Z`),
        startTime: "14:00",
        endTime: "16:00",
        isAvailable: true,
      },
    ];
    const slots = await searchDay(SUMMER_WED);
    expect(slots).toHaveLength(2);
    expect(slots[0].startsAt.toISOString()).toBe(`${SUMMER_WED}T13:00:00.000Z`); // 14:00 BST
  });

  it("returns nothing when an override marks the day unavailable", async () => {
    db.scheduleOverride = [
      { date: new Date(`${SUMMER_WED}T00:00:00.000Z`), startTime: null, endTime: null, isAvailable: false },
    ];
    expect(await searchDay(SUMMER_WED)).toHaveLength(0);
  });

  it("skips inactive instructors and those not taking learners", async () => {
    db.instructor = [{ ...INSTRUCTOR, active: false }];
    expect(await searchDay(SUMMER_WED)).toHaveLength(0);

    db.instructor = [{ ...INSTRUCTOR, acceptsNewLearners: false }];
    expect(await searchDay(SUMMER_WED)).toHaveLength(0);
  });

  it("skips instructors who don't offer intensives when one is requested", async () => {
    const slots = await searchAvailableSlots({
      postcode: "CR0 1AA",
      transmission: "MANUAL",
      lessonType: "INTENSIVE",
      startDate: new Date(`${SUMMER_WED}T00:00:00.000Z`),
      endDate: new Date(`${SUMMER_WED}T23:59:59.000Z`),
    });
    expect(slots).toHaveLength(0);
  });

  it("only considers confirmed bookings and live holds", async () => {
    // Cancelled lessons and lapsed holds are filtered in the query, so assert
    // the query rather than the result — a stub can't enforce it for us.
    await searchDay(SUMMER_WED);
    expect(lastWhere.booking.status).toEqual({ in: ["CONFIRMED"] });
    expect(lastWhere.slotHold.expiresAt).toHaveProperty("gt");
  });

  it("matches bookings overlapping the window, not just starting in it", async () => {
    // Regression: filtering on startsAt alone missed a lesson that began
    // before the window and ran into it, so the first slot could be offered
    // while already booked.
    await searchDay(SUMMER_WED);
    expect(lastWhere.booking).toHaveProperty("startsAt.lt");
    expect(lastWhere.booking).toHaveProperty("endsAt.gt");
  });

  it("returns slots in chronological order, capped at 20", async () => {
    db.availability = [
      { instructorId: "inst-1", dayOfWeek: 3, startTime: "06:00", endTime: "22:00" },
    ];
    const slots = await searchAvailableSlots({
      postcode: "CR0 1AA",
      transmission: "MANUAL",
      startDate: new Date("2026-08-05T00:00:00.000Z"),
      endDate: new Date("2026-08-26T23:59:59.000Z"),
    });
    expect(slots).toHaveLength(20);
    const times = slots.map((s) => s.startsAt.getTime());
    expect(times).toEqual([...times].sort((a, b) => a - b));
  });
});
