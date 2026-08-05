import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { rateLimit, getClientIp } from "@/app/lib/rate-limit";
import { authorize } from "@/app/lib/auth/api";
import { z } from "zod";

// Submit a review for a lesson you took.
const createSchema = z.object({
  bookingId: z.string(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(1000).optional(),
});

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    const rl = rateLimit(`review:${ip}`, 10, 60 * 1000);
    if (!rl.allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    // Reviews drive the ratings shown on the public instructor listing. This
    // used to be unauthenticated, so anyone who knew or guessed a booking id
    // could post a rating for a lesson they had nothing to do with.
    const { user, error } = await authorize();
    if (error) return error;

    const customer = await prisma.customer.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });
    if (!customer) {
      return NextResponse.json(
        { error: "Only the learner who took the lesson can review it" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = createSchema.parse(body);

    const booking = await prisma.booking.findUnique({
      where: { id: parsed.bookingId },
      select: { id: true, customerId: true, instructorId: true, status: true },
    });
    // Same answer for "not yours" as for "doesn't exist", so booking ids
    // can't be probed through this endpoint.
    if (!booking || booking.customerId !== customer.id) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }
    if (booking.status !== "COMPLETED") {
      return NextResponse.json({ error: "Can only review completed lessons" }, { status: 400 });
    }
    // A review rates the driver, so there has to be one. A completed lesson
    // always has been assigned, but the type allows null and this keeps the
    // review table honest.
    if (!booking.instructorId) {
      return NextResponse.json(
        { error: "That lesson has no instructor to review" },
        { status: 400 }
      );
    }

    const existing = await prisma.review.findUnique({
      where: { bookingId: parsed.bookingId },
    });
    if (existing) {
      return NextResponse.json({ error: "Review already exists for this booking" }, { status: 409 });
    }

    const review = await prisma.review.create({
      data: {
        bookingId: parsed.bookingId,
        instructorId: booking.instructorId,
        rating: parsed.rating,
        comment: parsed.comment,
      },
    });

    return NextResponse.json(review, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    console.error("Create review error:", error);
    return NextResponse.json({ error: "Failed to create review" }, { status: 500 });
  }
}

// Public: get reviews for an instructor
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const instructorId = url.searchParams.get("instructorId");

    if (!instructorId) {
      return NextResponse.json({ error: "instructorId required" }, { status: 400 });
    }

    // Public endpoint — select explicitly. Including the customer relation
    // wholesale previously published every reviewer's email and phone number.
    const reviews = await prisma.review.findMany({
      where: { instructorId },
      select: {
        id: true,
        rating: true,
        comment: true,
        createdAt: true,
        booking: {
          select: {
            startsAt: true,
            customer: {
              select: { user: { select: { name: true } } },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(reviews);
  } catch (error) {
    console.error("Get reviews error:", error);
    return NextResponse.json({ error: "Failed to fetch reviews" }, { status: 500 });
  }
}
