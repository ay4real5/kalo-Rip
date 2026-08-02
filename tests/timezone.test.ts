import { describe, expect, it } from "vitest";
import {
  calendarDateOf,
  dayOfWeekFor,
  eachDateInRange,
  nextDate,
  startOfLocalDay,
  zonedDateString,
  zonedTimeToUtc,
} from "@/app/lib/timezone";

// UK DST transitions used throughout: forward 29 Mar 2026, back 25 Oct 2026.

describe("zonedTimeToUtc", () => {
  it("treats wall-clock times as UK local, not server local", () => {
    // The bug: parsing "2026-08-05T09:00" on a UTC server produced 09:00Z,
    // offering a 9am lesson at 10am UK time for the whole of BST.
    expect(zonedTimeToUtc("2026-08-05", "09:00").toISOString()).toBe(
      "2026-08-05T08:00:00.000Z"
    );
  });

  it("uses GMT in winter", () => {
    expect(zonedTimeToUtc("2026-01-05", "09:00").toISOString()).toBe(
      "2026-01-05T09:00:00.000Z"
    );
  });

  it("keeps 9am at 9am across the spring transition", () => {
    expect(zonedTimeToUtc("2026-03-28", "09:00").toISOString()).toBe(
      "2026-03-28T09:00:00.000Z"
    );
    expect(zonedTimeToUtc("2026-03-29", "09:00").toISOString()).toBe(
      "2026-03-29T08:00:00.000Z"
    );
  });

  it("keeps 9am at 9am across the autumn transition", () => {
    expect(zonedTimeToUtc("2026-10-24", "09:00").toISOString()).toBe(
      "2026-10-24T08:00:00.000Z"
    );
    expect(zonedTimeToUtc("2026-10-25", "09:00").toISOString()).toBe(
      "2026-10-25T09:00:00.000Z"
    );
  });

  it("accepts seconds", () => {
    expect(zonedTimeToUtc("2026-08-05", "09:30:00").toISOString()).toBe(
      "2026-08-05T08:30:00.000Z"
    );
  });

  it("round-trips local midnight back to the same calendar date", () => {
    for (const date of ["2026-08-05", "2026-03-29", "2026-10-25", "2026-01-01"]) {
      expect(zonedDateString(zonedTimeToUtc(date, "00:00"))).toBe(date);
    }
  });
});

describe("eachDateInRange", () => {
  it("does not skip or repeat a day across the spring transition", () => {
    // Stepping by 24h drifted an hour at the transition and eventually
    // formatted the wrong date, dropping or duplicating a day's availability.
    expect(
      eachDateInRange(
        zonedTimeToUtc("2026-03-27", "12:00"),
        zonedTimeToUtc("2026-03-31", "12:00")
      )
    ).toEqual([
      "2026-03-27",
      "2026-03-28",
      "2026-03-29",
      "2026-03-30",
      "2026-03-31",
    ]);
  });

  it("does not skip or repeat a day across the autumn transition", () => {
    expect(
      eachDateInRange(
        zonedTimeToUtc("2026-10-23", "12:00"),
        zonedTimeToUtc("2026-10-27", "12:00")
      )
    ).toEqual([
      "2026-10-23",
      "2026-10-24",
      "2026-10-25",
      "2026-10-26",
      "2026-10-27",
    ]);
  });

  it("covers a fortnight without drift", () => {
    const dates = eachDateInRange(
      zonedTimeToUtc("2026-08-01", "00:00"),
      zonedTimeToUtc("2026-08-14", "23:59")
    );
    expect(dates).toHaveLength(14);
    expect(dates[0]).toBe("2026-08-01");
    expect(dates.at(-1)).toBe("2026-08-14");
  });

  it("is inclusive of a single-day range", () => {
    const day = zonedTimeToUtc("2026-08-05", "09:00");
    expect(eachDateInRange(day, day)).toEqual(["2026-08-05"]);
  });

  it("caps runaway ranges", () => {
    const dates = eachDateInRange(
      zonedTimeToUtc("2020-01-01", "00:00"),
      zonedTimeToUtc("2030-01-01", "00:00")
    );
    expect(dates).toHaveLength(400);
  });
});

describe("nextDate", () => {
  it("rolls over months, years and leap days", () => {
    expect(nextDate("2026-08-05")).toBe("2026-08-06");
    expect(nextDate("2026-08-31")).toBe("2026-09-01");
    expect(nextDate("2026-12-31")).toBe("2027-01-01");
    expect(nextDate("2028-02-28")).toBe("2028-02-29"); // 2028 is a leap year
  });
});

describe("dayOfWeekFor", () => {
  it("matches the UK calendar weekday", () => {
    expect(dayOfWeekFor("2026-08-05")).toBe(3); // Wednesday
    expect(dayOfWeekFor("2026-08-09")).toBe(0); // Sunday
  });

  it("is stable on a DST transition date", () => {
    expect(dayOfWeekFor("2026-03-29")).toBe(0); // Sunday
    expect(dayOfWeekFor("2026-10-25")).toBe(0); // Sunday
  });
});

describe("calendarDateOf", () => {
  it("reads a date-only column as the day it stands for", () => {
    expect(calendarDateOf(new Date("2026-08-05T00:00:00.000Z"))).toBe("2026-08-05");
  });
});

describe("startOfLocalDay", () => {
  it("returns UK midnight, which is 23:00Z the previous day in summer", () => {
    expect(
      startOfLocalDay(new Date("2026-08-05T14:00:00.000Z")).toISOString()
    ).toBe("2026-08-04T23:00:00.000Z");
  });

  it("returns UK midnight, which is 00:00Z in winter", () => {
    expect(
      startOfLocalDay(new Date("2026-01-05T14:00:00.000Z")).toISOString()
    ).toBe("2026-01-05T00:00:00.000Z");
  });
});
