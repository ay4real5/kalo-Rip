import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { cancelBooking } from "@/app/lib/booking-engine";
import { authorize } from "@/app/lib/auth/api";
import type { User } from "@prisma/client";
import { z } from "zod";

const bookingParties = {
  customer: { select: { id: true, userId: true } },
  instructor: { select: { id: true, userId: true } },
} as const;

const bookingView = {
  customer: {
    include: {
      user: { select: { id: true, name: true, email: true, phone: true } },
    },
  },
  instructor: {
    include: { user: { select: { id: true, name: true, phone: true } } },
  },
} as const;

/**
 * Load a booking and confirm this user may act on it.
 *
 * Role alone is not enough: the handlers used to accept any ADMIN *or
 * INSTRUCTOR*, so any instructor could read, reschedule or cancel a rival's
 * lessons, and any signed-in customer could read anyone's booking by id.
 */
async function loadPermittedBooking(id: string, user: User) {
  const booking = await prisma.booking.findUnique({
    where: { id },
    include: bookingParties,
  });

  // 404 for "not yours" as well as "not there", so ids can't be enumerated.
  if (!booking) return null;
  if (user.role === "ADMIN") return booking;
  if (booking.instructor.userId === user.id) return booking;
  if (booking.customer.userId === user.id) return booking;
  return null;
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error } = await authorize();
    if (error) return error;

    const { id } = await params;
    const booking = await loadPermittedBooking(id, user);
    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    // Only staff get to record why; a customer cancelling their own lesson
    // shouldn't be able to write arbitrary text onto the record.
    const isStaff = user.role === "ADMIN" || user.role === "INSTRUCTOR";
    const reason =
      isStaff && typeof body.reason === "string" ? body.reason : undefined;

    await cancelBooking(id, reason);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Cancel booking error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to cancel booking" },
      { status: 500 }
    );
  }
}

const rescheduleSchema = z.object({
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
  status: z.enum(["CONFIRMED", "COMPLETED", "CANCELLED"]).optional(),
  instructorNotes: z.string().max(2000).optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error } = await authorize(["ADMIN", "INSTRUCTOR"]);
    if (error) return error;

    const { id } = await params;
    const existing = await loadPermittedBooking(id, user);
    if (!existing) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }
    if (existing.status === "CANCELLED") {
      return NextResponse.json(
        { error: "Cannot modify a cancelled booking" },
        { status: 400 }
      );
    }

    const parsed = rescheduleSchema.parse(await request.json());

    const update: Record<string, unknown> = {};
    if (parsed.startsAt) update.startsAt = new Date(parsed.startsAt);
    if (parsed.endsAt) update.endsAt = new Date(parsed.endsAt);
    if (parsed.status) update.status = parsed.status;
    if (parsed.instructorNotes !== undefined) update.notes = parsed.instructorNotes;

    if (parsed.startsAt) {
      const startsAt = new Date(parsed.startsAt);
      const endsAt = parsed.endsAt
        ? new Date(parsed.endsAt)
        : new Date(
            startsAt.getTime() +
              (existing.endsAt.getTime() - existing.startsAt.getTime())
          );

      if (endsAt <= startsAt) {
        return NextResponse.json(
          { error: "endsAt must be after startsAt" },
          { status: 400 }
        );
      }
      update.endsAt = endsAt;

      const conflict = await prisma.booking.findFirst({
        where: {
          id: { not: id },
          instructorId: existing.instructorId,
          status: "CONFIRMED",
          startsAt: { lt: endsAt },
          endsAt: { gt: startsAt },
        },
      });
      if (conflict) {
        return NextResponse.json(
          { error: "Instructor has another booking at that time" },
          { status: 409 }
        );
      }
    }

    const updated = await prisma.booking.update({
      where: { id },
      data: update,
      include: bookingView,
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    console.error("Update booking error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update booking" },
      { status: 500 }
    );
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error } = await authorize();
    if (error) return error;

    const { id } = await params;
    const permitted = await loadPermittedBooking(id, user);
    if (!permitted) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: bookingView,
    });
    return NextResponse.json(booking);
  } catch (error) {
    console.error("Get booking error:", error);
    return NextResponse.json({ error: "Failed to fetch booking" }, { status: 500 });
  }
}
