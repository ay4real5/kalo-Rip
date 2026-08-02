import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireUser } from "@/app/lib/auth/server";

export async function GET(request: Request) {
  try {
    await requireUser();

    const url = new URL(request.url);
    const fromParam = url.searchParams.get("from");
    const toParam = url.searchParams.get("to");

    const from = fromParam ? new Date(fromParam) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const to = toParam ? new Date(toParam) : new Date();

    const [bookings, instructors, calls] = await Promise.all([
      prisma.booking.findMany({
        where: {
          startsAt: { gte: from, lte: to },
        },
        include: {
          customer: { include: { user: true } },
          instructor: { include: { user: true } },
        },
        orderBy: { startsAt: "desc" },
      }),
      prisma.instructor.findMany({
        include: {
          user: { select: { id: true, name: true, email: true } },
          bookings: {
            where: {
              startsAt: { gte: from, lte: to },
            },
            select: { id: true, pricePence: true, status: true },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.callLog.findMany({
        where: {
          startedAt: { gte: from, lte: to },
        },
        orderBy: { startedAt: "desc" },
      }),
    ]);

    return NextResponse.json({ bookings, instructors, calls, from: from.toISOString(), to: to.toISOString() });
  } catch (error) {
    console.error("Analytics error:", error);
    return NextResponse.json({ error: "Failed to fetch analytics" }, { status: 500 });
  }
}
