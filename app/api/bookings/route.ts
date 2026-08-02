import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { createBooking } from "@/app/lib/booking-engine";
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
