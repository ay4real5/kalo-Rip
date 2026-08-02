import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { rateLimit, getClientIp } from "@/app/lib/rate-limit";
import { z } from "zod";

// Public endpoint: look up bookings by email + postcode (no auth required).
// This lets customers who booked via the public form see their bookings
// without a Supabase account.
const schema = z.object({
  email: z.string().email(),
  postcode: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    const rl = rateLimit(`lookup:${ip}`, 10, 60 * 1000);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 }
      );
    }

    const body = await request.json();
    const parsed = schema.parse(body);

    const customer = await prisma.customer.findFirst({
      where: {
        user: { email: { equals: parsed.email, mode: "insensitive" } },
        postcode: { equals: parsed.postcode, mode: "insensitive" },
      },
      include: {
        user: true,
      },
    });

    if (!customer) {
      // Return empty rather than 404 to avoid leaking which emails exist
      return NextResponse.json({ bookings: [] });
    }

    const bookings = await prisma.booking.findMany({
      where: { customerId: customer.id },
      include: {
        instructor: { include: { user: true } },
      },
      orderBy: { startsAt: "asc" },
    });

    return NextResponse.json({ bookings });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    console.error("Booking lookup error:", error);
    return NextResponse.json({ error: "Failed to look up bookings" }, { status: 500 });
  }
}
