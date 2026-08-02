import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { sendLessonReminder } from "@/app/lib/notifications";
import { addDays, startOfDay, endOfDay } from "date-fns";

// Runs daily via Vercel Cron. Sends SMS reminders for lessons happening tomorrow.
export async function GET(request: Request) {
  // Verify the request is from Vercel Cron
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tomorrowStart = startOfDay(addDays(new Date(), 1));
  const tomorrowEnd = endOfDay(addDays(new Date(), 1));

  const bookings = await prisma.booking.findMany({
    where: {
      status: "CONFIRMED",
      startsAt: { gte: tomorrowStart, lte: tomorrowEnd },
    },
    include: {
      customer: { include: { user: true } },
      instructor: { include: { user: true } },
    },
  });

  let sent = 0;
  for (const booking of bookings) {
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
