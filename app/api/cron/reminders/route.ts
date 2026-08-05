import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { sendLessonReminder } from "@/app/lib/notifications";
import { nextDate, zonedDateString, zonedTimeToUtc } from "@/app/lib/timezone";

// Runs daily via Vercel Cron. Sends SMS reminders for lessons happening tomorrow.
export async function GET(request: Request) {
  // Verify the request is from Vercel Cron. Fails closed: without CRON_SECRET
  // this endpoint is refused rather than left open, since anyone hitting it
  // can trigger an SMS send to every customer with a lesson tomorrow.
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("CRON_SECRET is not set — refusing to run reminders.");
    return NextResponse.json({ error: "Cron not configured" }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // "Tomorrow" means tomorrow in the school's timezone, not the server's. A
  // server-local day boundary silently skipped early-morning lessons and
  // pulled in ones from the day after whenever the two zones disagreed.
  const tomorrow = nextDate(zonedDateString(new Date()));
  const tomorrowStart = zonedTimeToUtc(tomorrow, "00:00");
  const dayAfterStart = zonedTimeToUtc(nextDate(tomorrow), "00:00");

  const bookings = await prisma.booking.findMany({
    where: {
      status: "CONFIRMED",
      startsAt: { gte: tomorrowStart, lt: dayAfterStart },
    },
    include: {
      customer: { include: { user: true } },
      instructor: { include: { user: true } },
    },
  });

  let sent = 0;
  for (const booking of bookings) {
    // Only remind about lessons that have a driver. An unassigned one would
    // read "your lesson with your instructor", which tells the learner nothing
    // and invites a call the admin has to field.
    if (!booking.instructor) continue;

    try {
      const result = await sendLessonReminder({
        customer: booking.customer,
        instructor: booking.instructor,
        booking,
      });
      if (result.sent) sent++;
    } catch (error) {
      console.error("[cron] reminder failed for booking", booking.id, error);
    }
  }

  return NextResponse.json({ processed: bookings.length, sent });
}
