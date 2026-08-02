import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireUser } from "@/app/lib/auth/server";

export async function GET() {
  try {
    await requireUser();

    const [bookings, instructors, calls] = await Promise.all([
      prisma.booking.findMany({
        include: {
          customer: { include: { user: true } },
          instructor: { include: { user: true } },
        },
        orderBy: { startsAt: "desc" },
      }),
      prisma.instructor.findMany({
        include: {
          user: { select: { id: true, name: true, email: true } },
          bookings: { select: { id: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.callLog.findMany({ orderBy: { startedAt: "desc" } }),
    ]);

    return NextResponse.json({ bookings, instructors, calls });
  } catch (error) {
    console.error("Analytics error:", error);
    return NextResponse.json({ error: "Failed to fetch analytics" }, { status: 500 });
  }
}
