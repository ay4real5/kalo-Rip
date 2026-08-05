import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CallContext } from "@/app/lib/voice-tools";

/**
 * Identity rules for the phone agent.
 *
 * The model is not a trusted source of authorisation. Tools used to take a
 * customerId or bookingId as an argument and act on it, so a caller reciting
 * an id — or a prompt injection spoken down the line — could read or cancel a
 * stranger's lessons. Identity now comes from the phone line only.
 */

type Row = Record<string, unknown>;

const db = {
  customers: [] as Row[],
  bookings: [] as Row[],
  slots: [] as Row[],
  coverage: { covered: true, servedAreas: ["CR0", "SE25"] } as {
    covered: boolean;
    servedAreas: string[];
  },
};

const calls = { updates: [] as Row[], created: [] as Row[] };

vi.mock("@/app/lib/prisma", () => ({
  prisma: {
    // findCustomerByPhone normalises digits in SQL; the stub matches on the
    // trailing digits the same way so these tests exercise the real intent.
    $queryRaw: async (_strings: TemplateStringsArray, pattern: string) => {
      const tail = pattern.replace("%", "");
      const match = db.customers.find((c) =>
        String((c.user as Row).phone ?? "").replace(/\D/g, "").endsWith(tail)
      );
      return match ? [{ id: match.id }] : [];
    },
    customer: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        db.customers.find((c) => c.id === where.id) ?? null,
    },
    booking: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        db.bookings.find((b) => b.id === where.id) ?? null,
      findMany: async ({ where }: { where: Row }) =>
        db.bookings.filter((b) => b.customerId === where.customerId),
    },
    user: {
      create: async ({ data }: { data: Row }) => {
        calls.created.push(data);
        return { id: "user-new", name: data.name, customer: { id: "cust-new" } };
      },
    },
    callLog: {
      updateMany: async (args: Row) => {
        calls.updates.push(args);
        return { count: 1 };
      },
    },
  },
}));

vi.mock("@/app/lib/booking-engine", () => ({
  createBooking: vi.fn(async () => {
    throw new Error("createBooking should not be reached in these tests");
  }),
  cancelBooking: vi.fn(async (id: string) => ({ id, status: "CANCELLED" })),
  holdSlot: vi.fn(async () => ({ holdId: "hold-1", expiresAt: new Date() })),
  releaseHold: vi.fn(async () => undefined),
  searchAvailableSlots: vi.fn(async () => db.slots),
  checkAreaCoverage: vi.fn(async () => db.coverage),
  SlotUnavailableError: class SlotUnavailableError extends Error {},
  OutsideAvailabilityError: class OutsideAvailabilityError extends Error {},
  InvalidLessonDateError: class InvalidLessonDateError extends Error {},
}));

vi.mock("@/app/lib/notifications", () => ({
  sendBookingConfirmation: vi.fn(async () => ({ sent: true })),
}));

const { executeTool } = await import("@/app/lib/voice-tools");

const CALLER = "+447700900123";
const STRANGER_BOOKING = "booking-stranger";

function ctx(overrides: Partial<CallContext> = {}): CallContext {
  return {
    callSid: "CA123",
    fromNumber: CALLER,
    toNumber: "+441234567890",
    customerId: null,
    ...overrides,
  };
}

beforeEach(() => {
  calls.updates = [];
  calls.created = [];
  db.customers = [
    { id: "cust-1", postcode: "CR0 1AA", transmission: "MANUAL", user: { name: "Ayo", phone: CALLER } },
    { id: "cust-2", postcode: "SW1A 1AA", transmission: "AUTOMATIC", user: { name: "Someone Else", phone: "+447700900999" } },
  ];
  const lesson = {
    startsAt: new Date("2026-08-05T08:00:00.000Z"),
    endsAt: new Date("2026-08-05T09:00:00.000Z"),
    status: "CONFIRMED",
    instructor: { user: { name: "Sam" } },
  };
  db.slots = [];
  db.coverage = { covered: true, servedAreas: ["CR0", "SE25"] };
  db.bookings = [
    { id: "booking-mine", customerId: "cust-1", ...lesson },
    { id: STRANGER_BOOKING, customerId: "cust-2", ...lesson },
  ];
});

describe("identify_customer", () => {
  it("identifies by the calling number", async () => {
    const c = ctx();
    const result = (await executeTool("identify_customer", {}, c)) as Row;
    expect(result.name).toBe("Ayo");
    expect(c.customerId).toBe("cust-1");
  });

  it("cannot be pointed at another number by the model", async () => {
    // The old tool took a `phone` argument, so saying someone else's number
    // returned their record. The argument is now ignored entirely.
    const c = ctx();
    const result = (await executeTool(
      "identify_customer",
      { phone: "+447700900999" },
      c
    )) as Row;
    expect(result.name).toBe("Ayo");
    expect(c.customerId).toBe("cust-1");
  });

  it("matches regardless of stored formatting", async () => {
    db.customers = [
      { id: "cust-1", postcode: "CR0", transmission: "MANUAL", user: { name: "Ayo", phone: "+44 7700 900123" } },
    ];
    const c = ctx();
    expect(((await executeTool("identify_customer", {}, c)) as Row).name).toBe("Ayo");
  });

  it("refuses when the caller withheld their number", async () => {
    const c = ctx({ fromNumber: "anonymous" });
    const result = (await executeTool("identify_customer", {}, c)) as Row;
    expect(result.error).toMatch(/withheld/i);
    expect(c.customerId).toBeNull();
  });

  it("returns null for an unknown caller", async () => {
    const c = ctx({ fromNumber: "+447700900555" });
    expect(await executeTool("identify_customer", {}, c)).toBeNull();
  });

  it("records the identified caller on the call log", async () => {
    await executeTool("identify_customer", {}, ctx());
    expect(calls.updates[0]).toMatchObject({ data: { customerId: "cust-1" } });
  });
});

describe("create_customer", () => {
  it("stores the calling number, not one the model supplies", async () => {
    const c = ctx({ fromNumber: "+447700900555" });
    await executeTool(
      "create_customer",
      { name: "New Learner", postcode: "cr0 1aa", transmission: "MANUAL", phone: "+447700900999" },
      c
    );
    expect(calls.created[0].phone).toBe("+447700900555");
  });

  it("returns the existing record instead of duplicating a caller", async () => {
    const c = ctx();
    const result = (await executeTool(
      "create_customer",
      { name: "Ayo", postcode: "CR0 1AA", transmission: "MANUAL" },
      c
    )) as Row;
    expect(result.alreadyRegistered).toBe(true);
    expect(calls.created).toHaveLength(0);
    expect(c.customerId).toBe("cust-1");
  });
});

describe("get_customer_bookings", () => {
  it("returns only the caller's bookings", async () => {
    const bookings = (await executeTool(
      "get_customer_bookings",
      {},
      ctx({ customerId: "cust-1" })
    )) as Row[];
    expect(bookings.map((b) => b.bookingId)).toEqual(["booking-mine"]);
  });

  it("ignores a customerId supplied by the model", async () => {
    const bookings = (await executeTool(
      "get_customer_bookings",
      { customerId: "cust-2" },
      ctx({ customerId: "cust-1" })
    )) as Row[];
    expect(bookings.map((b) => b.bookingId)).toEqual(["booking-mine"]);
  });

  it("refuses before the caller is identified", async () => {
    const result = (await executeTool("get_customer_bookings", {}, ctx())) as Row;
    expect(result.error).toMatch(/identified/i);
  });
});

describe("cancel_booking", () => {
  it("cancels the caller's own booking", async () => {
    const result = (await executeTool(
      "cancel_booking",
      { bookingId: "booking-mine" },
      ctx({ customerId: "cust-1" })
    )) as Row;
    expect(result.status).toBe("CANCELLED");
  });

  it("refuses to cancel someone else's booking", async () => {
    // The hole: a caller naming any booking id could cancel that lesson.
    const result = (await executeTool(
      "cancel_booking",
      { bookingId: STRANGER_BOOKING },
      ctx({ customerId: "cust-1" })
    )) as Row;
    expect(result.error).toMatch(/no such booking/i);
    expect(result.status).toBeUndefined();
  });

  it("gives the same answer for a booking that doesn't exist", async () => {
    const notYours = (await executeTool(
      "cancel_booking",
      { bookingId: STRANGER_BOOKING },
      ctx({ customerId: "cust-1" })
    )) as Row;
    const notThere = (await executeTool(
      "cancel_booking",
      { bookingId: "no-such-id" },
      ctx({ customerId: "cust-1" })
    )) as Row;
    // Identical, so ids can't be probed for existence.
    expect(notYours).toEqual(notThere);
  });

  it("refuses before the caller is identified", async () => {
    const result = (await executeTool(
      "cancel_booking",
      { bookingId: "booking-mine" },
      ctx()
    )) as Row;
    expect(result.error).toMatch(/identified/i);
  });
});

describe("confirm_booking", () => {
  it("refuses before the caller is identified", async () => {
    const result = (await executeTool(
      "confirm_booking",
      { instructorId: "inst-1", startsAt: "2026-08-05T08:00:00Z", endsAt: "2026-08-05T09:00:00Z" },
      ctx()
    )) as Row;
    expect(result.error).toMatch(/identified/i);
  });
});

describe("search_available_lesson_slots", () => {
  it("gives the agent a spoken UK local time, not a raw UTC timestamp", async () => {
    // Found by a live call: handed only ISO instants, the model read the UTC
    // clock time out as the lesson time — offering 8am for a 9am lesson
    // through BST — and invented the date. `when` is the spoken form.
    db.slots = [
      {
        instructorId: "inst-1",
        instructorName: "Jane",
        startsAt: new Date("2026-08-05T08:00:00.000Z"), // 09:00 UK, BST
        endsAt: new Date("2026-08-05T09:00:00.000Z"),
        pricePence: 3800,
        vehicleType: "Corsa",
        postcode: "CR0 1AA",
      },
    ];

    const { slots } = (await executeTool(
      "search_available_lesson_slots",
      { postcode: "CR0 1AA", transmission: "AUTOMATIC" },
      ctx()
    )) as { slots: Row[] };
    const slot = slots[0];

    expect(slot.when).toContain("9:00");
    expect(slot.when).toContain("Wednesday");
    expect(slot.when).toContain("5 August");
    expect(slot.when).not.toContain("8:00");
    // The machine-readable instant is still there for hold/confirm to use.
    expect(slot.startsAt).toBe("2026-08-05T08:00:00.000Z");
  });


  it("uses GMT in winter", async () => {
    db.slots = [
      {
        instructorId: "inst-1",
        instructorName: "Jane",
        startsAt: new Date("2026-01-07T09:00:00.000Z"), // 09:00 UK, GMT
        endsAt: new Date("2026-01-07T10:00:00.000Z"),
        pricePence: 3800,
        vehicleType: "Corsa",
        postcode: "CR0 1AA",
      },
    ];
    const { slots } = (await executeTool(
      "search_available_lesson_slots",
      { postcode: "CR0 1AA", transmission: "AUTOMATIC" },
      ctx()
    )) as { slots: Row[] };
    expect(slots[0].when).toContain("9:00");
  });

  it("gives no reason when slots were found", async () => {
    db.slots = [
      {
        instructorId: "inst-1",
        instructorName: "Jane",
        startsAt: new Date("2026-08-05T08:00:00.000Z"),
        endsAt: new Date("2026-08-05T09:00:00.000Z"),
        pricePence: 3800,
        vehicleType: "Corsa",
        postcode: "CR0 1AA",
      },
    ];
    const result = (await executeTool(
      "search_available_lesson_slots",
      { postcode: "CR0 1AA", transmission: "AUTOMATIC" },
      ctx()
    )) as Row;
    // `reason` is the agent's cue to apologise and offer alternatives. It must
    // never appear alongside real slots, or the agent talks the caller out of
    // a booking it could have made.
    expect(result.reason).toBeUndefined();
    expect((result.slots as Row[]).length).toBe(1);
  });
});

/**
 * A real call exposed this: a learner in BR6 was told "there are no available
 * slots at all" and rang off. No instructor covered BR6 — the school simply
 * doesn't serve Orpington — but an empty list carried no reason, so the agent
 * couldn't tell "we don't cover you" from "we're full" and dead-ended a lead.
 */
describe("search_available_lesson_slots — empty results carry a reason", () => {
  it("says AREA_NOT_COVERED when no instructor serves the postcode", async () => {
    db.slots = [];
    db.coverage = { covered: false, servedAreas: ["CR0", "CR7", "SE25"] };

    const result = (await executeTool(
      "search_available_lesson_slots",
      { postcode: "BR6 5XF", transmission: "AUTOMATIC" },
      ctx()
    )) as Row;

    expect(result.reason).toBe("AREA_NOT_COVERED");
    expect(result.servedAreas).toEqual(["CR0", "CR7", "SE25"]);
    // The agent needs the caller's own area named back to sound credible.
    expect(String(result.message)).toContain("BR6");
    expect(String(result.message)).toContain("CR0");
  });

  it("says NO_AVAILABILITY when the area is covered but nothing is free", async () => {
    db.slots = [];
    db.coverage = { covered: true, servedAreas: ["CR0", "SE25"] };

    const result = (await executeTool(
      "search_available_lesson_slots",
      { postcode: "CR0 1AA", transmission: "AUTOMATIC" },
      ctx()
    )) as Row;

    expect(result.reason).toBe("NO_AVAILABILITY");
    expect(String(result.message).toLowerCase()).toContain("waitlist");
  });

  it("distinguishes the two cases rather than collapsing them", async () => {
    // The whole point: same empty list, different advice to the caller.
    db.slots = [];

    db.coverage = { covered: false, servedAreas: ["CR0"] };
    const uncovered = (await executeTool(
      "search_available_lesson_slots",
      { postcode: "BR6 5XF", transmission: "AUTOMATIC" },
      ctx()
    )) as Row;

    db.coverage = { covered: true, servedAreas: ["CR0"] };
    const full = (await executeTool(
      "search_available_lesson_slots",
      { postcode: "CR0 1AA", transmission: "AUTOMATIC" },
      ctx()
    )) as Row;

    expect(uncovered.reason).not.toBe(full.reason);
    expect((uncovered.slots as Row[]).length).toBe(0);
    expect((full.slots as Row[]).length).toBe(0);
  });
});

describe("tool definitions", () => {
  it("expose no customerId or phone argument for the model to set", async () => {
    const { getToolDefinitions } = await import("@/app/lib/voice-tools");
    for (const tool of getToolDefinitions()) {
      const params = tool.function.parameters as { properties?: Record<string, unknown> };
      const names = Object.keys(params.properties ?? {});
      expect(names).not.toContain("customerId");
      expect(names).not.toContain("customerPhone");
      expect(names).not.toContain("phone");
    }
  });
});
