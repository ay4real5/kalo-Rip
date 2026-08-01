import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

export async function GET() {
  const bookings = await prisma.booking.findMany({
    include: {
      customer: { include: { user: true } },
      instructor: { include: { user: true } },
    },
    orderBy: { startsAt: "desc" },
  });
  return NextResponse.json(bookings);
}
