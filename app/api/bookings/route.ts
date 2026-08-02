import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { createBooking } from "@/app/lib/booking-engine";
import { sendEmail, bookingConfirmationHtml } from "@/app/lib/email";
import { sendBookingConfirmation } from "@/app/lib/notifications";
import { rateLimit, getClientIp } from "@/app/lib/rate-limit";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().min(1),
  postcode: z.string().min(1),
  transmission: z.enum(["MANUAL", "AUTOMATIC", "BOTH"]).default("MANUAL"),
  instructorId: z.string(),
  startsAt: z.string(),
  endsAt: z.string().optional(),
  lessonType: z.enum(["REGULAR", "INTENSIVE", "TEST", "REFRESHER"]).default("REGULAR"),
  notes: z.string().optional(),
  source: z.enum(["PHONE_AI", "PORTAL", "ADMIN"]).default("PORTAL"),
});

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

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    const rl = rateLimit(`booking:${ip}`, 10, 60 * 1000);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many booking attempts. Please try again later." },
        { status: 429, headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } }
      );
    }

    const body = await request.json();
    const parsed = createSchema.parse(body);

    const user = await prisma.user.create({
      data: {
        email: parsed.email,
        name: parsed.name,
        phone: parsed.phone,
        role: "CUSTOMER",
      },
    });

    const customer = await prisma.customer.create({
      data: {
        userId: user.id,
        postcode: parsed.postcode,
        transmission: parsed.transmission,
      },
    });

    const booking = await createBooking({
      customerId: customer.id,
      instructorId: parsed.instructorId,
      startsAt: new Date(parsed.startsAt),
      endsAt: parsed.endsAt ? new Date(parsed.endsAt) : undefined,
      lessonType: parsed.lessonType,
      notes: parsed.notes,
      source: parsed.source,
    });

    // Fire and forget — do not block the response on email/SMS
    sendEmail({
      to: parsed.email,
      subject: "Your driving lesson is booked",
      html: bookingConfirmationHtml({
        instructorName: booking.instructor.user.name ?? "Your instructor",
        startsAt: booking.startsAt.toISOString(),
        endsAt: booking.endsAt.toISOString(),
        pricePence: booking.pricePence,
        customerName: parsed.name,
      }),
    }).catch((err) => console.error("[bookings] email failed:", err));

    sendBookingConfirmation({
      customer: { ...customer, user },
      instructor: booking.instructor,
      booking,
    }).catch((err) => console.error("[bookings] sms failed:", err));

    return NextResponse.json(booking, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    console.error("Create booking error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create booking" },
      { status: 500 }
    );
  }
}
