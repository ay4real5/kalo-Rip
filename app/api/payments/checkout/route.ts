import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { createPaymentSession } from "@/app/lib/payments";
import { z } from "zod";

const schema = z.object({
  bookingId: z.string(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { bookingId } = schema.parse(body);

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { customer: { include: { user: true } } },
    });
    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://kalo-rip.vercel.app";
    const session = await createPaymentSession({
      bookingId: booking.id,
      amountPence: booking.pricePence,
      customerEmail: booking.customer.user.email,
      description: `Driving lesson on ${new Date(booking.startsAt).toLocaleDateString("en-GB")}`,
      successUrl: `${baseUrl}/api/payments/success?bookingId=${booking.id}`,
      cancelUrl: `${baseUrl}/admin?tab=bookings`,
    });

    return NextResponse.json(session);
  } catch (error) {
    console.error("Checkout error:", error);
    return NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 });
  }
}
