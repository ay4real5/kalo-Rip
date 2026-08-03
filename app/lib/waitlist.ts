import { prisma } from "@/app/lib/prisma";
import { sendSms } from "@/app/lib/notifications";
import { SCHOOL_TIMEZONE, calendarDateOf, zonedDateString } from "@/app/lib/timezone";

/**
 * Waitlist matching.
 *
 * A cancelled lesson used to just disappear: the slot returned to general
 * availability and nobody was told, so late cancellations mostly stayed empty.
 * Learners who wanted that time are now texted, earliest-joined first.
 *
 * Notification is best-effort and deliberately decoupled from the cancellation
 * itself — a texting failure must never leave a lesson uncancelled.
 */

/** How many learners to text per freed slot. */
const DEFAULT_NOTIFY_LIMIT = 3;

export interface FreedSlot {
  instructorId: string;
  startsAt: Date;
  endsAt: Date;
}

/** "17:30" in UK local time, for comparing against a learner's preference. */
function localTimeOf(instant: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: SCHOOL_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(instant);
}

function formatSlot(instant: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: SCHOOL_TIMEZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(instant);
}

/**
 * Does this entry want this slot?
 *
 * Date bounds are date-only columns standing for whole local days, so they are
 * compared as calendar dates rather than instants — otherwise a slot late on
 * the last day would fall outside a range that plainly includes it.
 */
export function entryWantsSlot(
  entry: {
    instructorId: string | null;
    earliestDate: Date;
    latestDate: Date;
    earliestTime: string | null;
    latestTime: string | null;
  },
  slot: FreedSlot
): boolean {
  if (entry.instructorId && entry.instructorId !== slot.instructorId) return false;

  const slotDate = zonedDateString(slot.startsAt);
  if (slotDate < calendarDateOf(entry.earliestDate)) return false;
  if (slotDate > calendarDateOf(entry.latestDate)) return false;

  const slotTime = localTimeOf(slot.startsAt);
  if (entry.earliestTime && slotTime < entry.earliestTime) return false;
  // Compared against the lesson's start: a learner who says "up to 17:00"
  // means one starting by 17:00, not one that has finished by then.
  if (entry.latestTime && slotTime > entry.latestTime) return false;

  return true;
}

/**
 * Text the learners waiting for a slot that just freed up.
 *
 * Returns how many were notified. Never throws: callers are cancelling a
 * lesson and that must succeed regardless.
 */
export async function notifyWaitlistForSlot(
  slot: FreedSlot,
  limit = DEFAULT_NOTIFY_LIMIT
): Promise<{ notified: number }> {
  try {
    // Narrow in the database, then apply the time-of-day rule in code, since
    // it depends on the UK offset for that particular date.
    const candidates = await prisma.waitlistEntry.findMany({
      where: {
        status: "ACTIVE",
        OR: [{ instructorId: slot.instructorId }, { instructorId: null }],
      },
      include: {
        customer: { include: { user: true } },
        instructor: { include: { user: { select: { name: true } } } },
      },
      // First come, first served.
      orderBy: { createdAt: "asc" },
    });

    const matches = candidates.filter((entry) => entryWantsSlot(entry, slot)).slice(0, limit);
    if (matches.length === 0) return { notified: 0 };

    const instructorName =
      matches[0].instructor?.user?.name ??
      (await prisma.instructor.findUnique({
        where: { id: slot.instructorId },
        select: { user: { select: { name: true } } },
      }))?.user?.name ??
      "an instructor";

    let notified = 0;
    for (const entry of matches) {
      const phone = entry.customer.user?.phone ?? "";
      if (!phone || entry.customer.smsOptIn === false) continue;

      const sent = await sendSms(
        phone,
        `A driving lesson slot has just opened up: ${formatSlot(slot.startsAt)} with ${instructorName}. ` +
          `Call us to take it — first to book gets it. Reply STOP to opt out.`
      );
      if (sent) notified++;

      // Marked notified whether or not the SMS landed, so a persistently
      // unreachable number can't monopolise every freed slot.
      await prisma.waitlistEntry.update({
        where: { id: entry.id },
        data: { status: "NOTIFIED", notifiedAt: new Date() },
      });
    }

    return { notified };
  } catch (error) {
    console.error("[waitlist] notification failed for freed slot:", error);
    return { notified: 0 };
  }
}
