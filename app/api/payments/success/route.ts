import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const bookingId = url.searchParams.get("bookingId");
  if (!bookingId) {
    return NextResponse.redirect(new URL("/admin?tab=bookings", request.url));
  }

  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (booking && !booking.paidAt) {
    await prisma.booking.update({
      where: { id: bookingId },
      data: { paidAt: new Date() },
    });
  }

  return NextResponse.redirect(new URL(`/admin?tab=bookings&paid=1`, request.url));
}
