import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { authorize } from "@/app/lib/auth/api";
import { z } from "zod";

// HH:MM, 24-hour.
const timeOfDay = /^([01]\d|2[0-3]):[0-5]\d$/;

const createSchema = z
  .object({
    instructorId: z.string().optional(),
    earliestDate: z.string().datetime(),
    latestDate: z.string().datetime(),
    earliestTime: z.string().regex(timeOfDay, "Expected HH:MM").optional(),
    latestTime: z.string().regex(timeOfDay, "Expected HH:MM").optional(),
  })
  .refine((v) => new Date(v.earliestDate) <= new Date(v.latestDate), {
    message: "earliestDate must not be after latestDate",
  })
  .refine((v) => !v.earliestTime || !v.latestTime || v.earliestTime <= v.latestTime, {
    message: "earliestTime must not be after latestTime",
  });

/** How many open entries one learner may hold. */
const MAX_ACTIVE_ENTRIES = 5;

/** Join the waitlist for a slot that isn't currently free. */
export async function POST(request: Request) {
  try {
    const { user, error } = await authorize();
    if (error) return error;

    const customer = await prisma.customer.findUnique({ where: { userId: user.id } });
    if (!customer) {
      return NextResponse.json(
        { error: "Only learners can join the waitlist" },
        { status: 403 }
      );
    }

    const parsed = createSchema.parse(await request.json());

    if (parsed.instructorId) {
      const instructor = await prisma.instructor.findUnique({
        where: { id: parsed.instructorId },
        select: { id: true, active: true },
      });
      if (!instructor?.active) {
        return NextResponse.json({ error: "Instructor not found" }, { status: 404 });
      }
    }

    // Stops one learner blanketing every slot and crowding out the queue.
    const active = await prisma.waitlistEntry.count({
      where: { customerId: customer.id, status: "ACTIVE" },
    });
    if (active >= MAX_ACTIVE_ENTRIES) {
      return NextResponse.json(
        { error: `You can have at most ${MAX_ACTIVE_ENTRIES} waitlist requests open.` },
        { status: 409 }
      );
    }

    const entry = await prisma.waitlistEntry.create({
      data: {
        customerId: customer.id,
        instructorId: parsed.instructorId ?? null,
        earliestDate: new Date(parsed.earliestDate),
        latestDate: new Date(parsed.latestDate),
        earliestTime: parsed.earliestTime ?? null,
        latestTime: parsed.latestTime ?? null,
      },
    });

    return NextResponse.json(entry, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors }, { status: 400 });
    }
    console.error("Join waitlist error:", err);
    return NextResponse.json({ error: "Failed to join waitlist" }, { status: 500 });
  }
}

/** The caller's own waitlist entries. */
export async function GET() {
  try {
    const { user, error } = await authorize();
    if (error) return error;

    const customer = await prisma.customer.findUnique({ where: { userId: user.id } });
    if (!customer) return NextResponse.json({ items: [] });

    const items = await prisma.waitlistEntry.findMany({
      where: { customerId: customer.id, status: { in: ["ACTIVE", "NOTIFIED"] } },
      include: { instructor: { include: { user: { select: { name: true } } } } },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ items });
  } catch (err) {
    console.error("List waitlist error:", err);
    return NextResponse.json({ error: "Failed to load waitlist" }, { status: 500 });
  }
}

/** Leave the waitlist. */
export async function DELETE(request: Request) {
  try {
    const { user, error } = await authorize();
    if (error) return error;

    const id = new URL(request.url).searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }

    const customer = await prisma.customer.findUnique({ where: { userId: user.id } });
    if (!customer) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Scoped to the caller's own entries, so an id alone can't cancel
    // somebody else's place in the queue.
    const removed = await prisma.waitlistEntry.updateMany({
      where: { id, customerId: customer.id },
      data: { status: "CANCELLED" },
    });
    if (removed.count === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Leave waitlist error:", err);
    return NextResponse.json({ error: "Failed to leave waitlist" }, { status: 500 });
  }
}
