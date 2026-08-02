import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { cancelBooking } from "@/app/lib/booking-engine";
import { requireUser } from "@/app/lib/auth/server";
import { z } from "zod";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    if (user.role !== "ADMIN" && user.role !== "INSTRUCTOR") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const reason = typeof body.reason === "string" ? body.reason : undefined;

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
  startsAt: z.string().optional(),
  endsAt: z.string().optional(),
  status: z.enum(["CONFIRMED", "COMPLETED", "CANCELLED"]).optional(),
  instructorNotes: z.string().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    if (user.role !== "ADMIN" && user.role !== "INSTRUCTOR") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const parsed = rescheduleSchema.parse(body);

    const existing = await prisma.booking.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }
    if (existing.status === "CANCELLED" && parsed.status !== "CANCELLED") {
      return NextResponse.json({ error: "Cannot modify a cancelled booking" }, { status: 400 });
    }

    const update: Record<string, unknown> = {};
    if (parsed.startsAt) update.startsAt = new Date(parsed.startsAt);
    if (parsed.endsAt) update.endsAt = new Date(parsed.endsAt);
    if (parsed.status) update.status = parsed.status;
    if (parsed.instructorNotes !== undefined) update.notes = parsed.instructorNotes;

    if (parsed.startsAt) {
      const startsAt = parsed.startsAt ? new Date(parsed.startsAt) : existing.startsAt;
      const endsAt = parsed.endsAt ? new Date(parsed.endsAt) : new Date(startsAt.getTime() + existing.endsAt.getTime() - existing.startsAt.getTime());

      // Check for conflicts (excluding this booking)
      const conflict = await prisma.booking.findFirst({
        where: {
          id: { not: id },
          instructorId: existing.instructorId,
          status: "CONFIRMED",
          OR: [
            { startsAt: { lt: endsAt }, endsAt: { gt: startsAt } },
          ],
        },
      });
      if (conflict) {
        return NextResponse.json({ error: "Instructor has another booking at that time" }, { status: 409 });
      }
    }

    const updated = await prisma.booking.update({
      where: { id },
      data: update,
      include: {
        customer: { include: { user: true } },
        instructor: { include: { user: true } },
      },
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
    await requireUser();
    const { id } = await params;
    const booking = await prisma.booking.findUnique({
      where: { id },
      include: {
        customer: { include: { user: true } },
        instructor: { include: { user: true } },
      },
    });
    if (!booking) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(booking);
  } catch (error) {
    console.error("Get booking error:", error);
    return NextResponse.json({ error: "Failed to fetch booking" }, { status: 500 });
  }
}
