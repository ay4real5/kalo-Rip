/**
 * Timezone handling for lesson scheduling.
 *
 * Availability is stored as wall-clock strings ("09:00") against a weekday or
 * a calendar date. Those are UK local times: an instructor who says they work
 * from 9am means 9am where they live, in whatever offset is in force that day.
 *
 * The server does not run in UK time — Vercel runs in UTC — so wall-clock
 * strings must never be handed to `new Date()` without a zone. Doing that
 * parsed them in the server's zone, which shifted every slot by an hour for
 * the ~7 months of the year the UK is on BST.
 *
 * Dates are also stepped a calendar day at a time rather than by adding 24h,
 * which drifts by an hour across each DST transition and eventually lands on
 * the wrong day entirely.
 *
 * Everything here returns real UTC instants; only the boundary conversions
 * know about local time.
 */

export const SCHOOL_TIMEZONE = process.env.SCHOOL_TIMEZONE ?? "Europe/London";

/** Offset (ms) between the given zone and UTC at a specific instant. */
function zoneOffsetMs(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);

  const field: Record<string, number> = {};
  for (const part of parts) {
    if (part.type !== "literal") field[part.type] = Number(part.value);
  }

  const asUtc = Date.UTC(
    field.year,
    field.month - 1,
    field.day,
    // hour12:false reports midnight as 24 in some ICU versions.
    field.hour % 24,
    field.minute,
    field.second
  );
  return asUtc - instant.getTime();
}

/**
 * Convert a local date + wall-clock time to the UTC instant it refers to.
 *
 *   zonedTimeToUtc("2026-08-05", "09:00")  ->  2026-08-05T08:00:00Z  (BST)
 *   zonedTimeToUtc("2026-01-05", "09:00")  ->  2026-01-05T09:00:00Z  (GMT)
 *
 * Times skipped by a spring-forward resolve to the following instant; times
 * repeated by an autumn fall-back resolve to the first occurrence.
 */
export function zonedTimeToUtc(
  dateString: string,
  timeString: string,
  timeZone: string = SCHOOL_TIMEZONE
): Date {
  const [year, month, day] = dateString.split("-").map(Number);
  const [hour, minute = 0, second = 0] = timeString.split(":").map(Number);
  const naive = Date.UTC(year, month - 1, day, hour, minute, second);

  // The offset depends on the instant, which is what we're solving for, so
  // guess with the offset at the naive instant and refine once. A single
  // refinement settles it either side of a transition.
  const guess = zoneOffsetMs(new Date(naive), timeZone);
  const refined = zoneOffsetMs(new Date(naive - guess), timeZone);
  return new Date(naive - refined);
}

/** The calendar date ("yyyy-MM-dd") an instant falls on, in the given zone. */
export function zonedDateString(
  instant: Date,
  timeZone: string = SCHOOL_TIMEZONE
): string {
  // en-CA formats as yyyy-MM-dd.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
}

/** Day of week (0 = Sunday) for a "yyyy-MM-dd" calendar date. */
export function dayOfWeekFor(dateString: string): number {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

/** The next calendar date after "yyyy-MM-dd". DST-safe: pure date arithmetic. */
export function nextDate(dateString: string): string {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
}

/**
 * Every local calendar date touched by the range, inclusive.
 * Capped to keep a bad range from spinning.
 */
export function eachDateInRange(
  start: Date,
  end: Date,
  timeZone: string = SCHOOL_TIMEZONE,
  maxDays = 400
): string[] {
  const last = zonedDateString(end, timeZone);
  const dates: string[] = [];

  let cursor = zonedDateString(start, timeZone);
  while (cursor <= last && dates.length < maxDays) {
    dates.push(cursor);
    cursor = nextDate(cursor);
  }
  return dates;
}

/**
 * The calendar date a date-only column refers to.
 *
 * Blackout and override rows are written as midnight UTC standing for a whole
 * local day, so they are read back in UTC rather than converted.
 */
export function calendarDateOf(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Midnight local time, as a UTC instant, for the day an instant falls on. */
export function startOfLocalDay(
  instant: Date,
  timeZone: string = SCHOOL_TIMEZONE
): Date {
  return zonedTimeToUtc(zonedDateString(instant, timeZone), "00:00", timeZone);
}
