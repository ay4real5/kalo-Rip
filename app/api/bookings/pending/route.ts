import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { authorize } from "@/app/lib/auth/api";
import { eligibleInstructorsFor } from "@/app/lib/booking-engine";

/**
 * The assignment queue: lessons whose time is secured but which have no driver.
 *
 * Each entry carries the drivers who could actually take it — already filtered
 * by area, transmission, working hours, blackouts, travel buffer and daily cap
 * — so the admin picks from a list of genuinely available people rather than
 * guessing and being rejected on save.
 */
export async function GET() {
  try {
    const { error } = await authorize(["ADMIN"]);
    if (error) return error;

    const pending = await prisma.booking.findMany({
      where: { instructorId: null, status: "PENDING_ASSIGNMENT" },
      include: {
        customer: {
          include: { user: { select: { name: true, phone: true, email: true } } },
        },
      },
      orderBy: { startsAt: "asc" },
      take: 100,
    });

    // Sequential rather than parallel: each call runs the availability engine
    // over a day's diary, and the queue is small. Hammering the database with
    // 100 concurrent scans to save a few milliseconds is a poor trade.
    const items = [];
    for (const booking of pending) {
      items.push({
        ...booking,
        eligibleInstructors: await eligibleInstructorsFor(booking.id),
      });
    }

    return NextResponse.json({ items, total: items.length });
  } catch (err) {
    console.error("Pending bookings error:", err);
    return NextResponse.json(
      { error: "Failed to load pending bookings" },
      { status: 500 }
    );
  }
}
