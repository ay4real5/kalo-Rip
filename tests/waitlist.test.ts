import { describe, expect, it } from "vitest";
import { entryWantsSlot, type FreedSlot } from "@/app/lib/waitlist";

/**
 * Waitlist matching. A cancelled lesson used to just vanish — the slot went
 * back into general availability and nobody was told — so late cancellations
 * mostly stayed empty. These rules decide who hears about a freed slot.
 */

// 12:00Z on a summer Wednesday is 13:00 UK (BST).
const SLOT: FreedSlot = {
  instructorId: "inst-1",
  startsAt: new Date("2026-08-05T12:00:00.000Z"),
  endsAt: new Date("2026-08-05T13:00:00.000Z"),
};

const entry = (over: Partial<Parameters<typeof entryWantsSlot>[0]> = {}) => ({
  instructorId: null,
  earliestDate: new Date("2026-08-01T00:00:00.000Z"),
  latestDate: new Date("2026-08-31T00:00:00.000Z"),
  earliestTime: null,
  latestTime: null,
  ...over,
});

describe("entryWantsSlot", () => {
  it("matches an open request inside the date range", () => {
    expect(entryWantsSlot(entry(), SLOT)).toBe(true);
  });

  it("matches when the requested instructor is the one who freed up", () => {
    expect(entryWantsSlot(entry({ instructorId: "inst-1" }), SLOT)).toBe(true);
  });

  it("does not match a request for a different instructor", () => {
    expect(entryWantsSlot(entry({ instructorId: "inst-2" }), SLOT)).toBe(false);
  });

  it("rejects slots before or after the date range", () => {
    expect(
      entryWantsSlot(
        entry({ earliestDate: new Date("2026-08-06T00:00:00.000Z") }),
        SLOT
      )
    ).toBe(false);
    expect(
      entryWantsSlot(
        entry({ latestDate: new Date("2026-08-04T00:00:00.000Z") }),
        SLOT
      )
    ).toBe(false);
  });

  it("includes slots on the first and last day of the range", () => {
    // Date bounds are whole local days. Comparing them as instants would drop
    // an afternoon slot on the final day, which plainly is in range.
    expect(
      entryWantsSlot(
        entry({
          earliestDate: new Date("2026-08-05T00:00:00.000Z"),
          latestDate: new Date("2026-08-05T00:00:00.000Z"),
        }),
        SLOT
      )
    ).toBe(true);
  });

  it("applies time preferences in UK local time, not UTC", () => {
    // The slot is 13:00 UK. A learner free from 13:00 wants it; one who must
    // finish by 12:00 does not. Judged in UTC, 12:00Z would wrongly pass the
    // second test and fail the first.
    expect(entryWantsSlot(entry({ earliestTime: "13:00" }), SLOT)).toBe(true);
    expect(entryWantsSlot(entry({ latestTime: "12:00" }), SLOT)).toBe(false);
  });

  it("respects an evenings-only preference", () => {
    const evenings = entry({ earliestTime: "17:00", latestTime: "20:00" });
    expect(entryWantsSlot(evenings, SLOT)).toBe(false);

    const eveningSlot: FreedSlot = {
      ...SLOT,
      startsAt: new Date("2026-08-05T17:00:00.000Z"), // 18:00 UK
      endsAt: new Date("2026-08-05T18:00:00.000Z"),
    };
    expect(entryWantsSlot(evenings, eveningSlot)).toBe(true);
  });

  it("treats the latest time as the latest start, not the latest finish", () => {
    // "Up to 13:00" means a lesson starting by 13:00, even though it ends at 14:00.
    expect(entryWantsSlot(entry({ latestTime: "13:00" }), SLOT)).toBe(true);
  });

  it("handles a winter slot, where UK local equals UTC", () => {
    const winterSlot: FreedSlot = {
      instructorId: "inst-1",
      startsAt: new Date("2026-01-07T13:00:00.000Z"), // 13:00 UK, GMT
      endsAt: new Date("2026-01-07T14:00:00.000Z"),
    };
    const winterEntry = entry({
      earliestDate: new Date("2026-01-01T00:00:00.000Z"),
      latestDate: new Date("2026-01-31T00:00:00.000Z"),
      earliestTime: "13:00",
      latestTime: "13:00",
    });
    expect(entryWantsSlot(winterEntry, winterSlot)).toBe(true);
  });
});
