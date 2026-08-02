import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { authorizeInstructor } from "@/app/lib/auth/api";
import { z } from "zod";

// Every handler here was previously unauthenticated: anyone could read, add or
// delete an instructor's working hours, and the booking engine sells whatever
// these rows say. Now scoped to the instructor themselves, or an admin.

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { error } = await authorizeInstructor(id);
  if (error) return error;

  const availability = await prisma.availability.findMany({
    where: { instructorId: id },
    orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
  });
  return NextResponse.json(availability);
}

// HH:MM or HH:MM:SS, 24-hour.
const timeOfDay = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

const createSchema = z
  .object({
    dayOfWeek: z.number().int().min(0).max(6),
    startTime: z.string().regex(timeOfDay, "Expected HH:MM"),
    endTime: z.string().regex(timeOfDay, "Expected HH:MM"),
  })
  .refine((v) => v.startTime < v.endTime, {
    message: "startTime must be before endTime",
  });

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { error } = await authorizeInstructor(id);
    if (error) return error;

    const parsed = createSchema.parse(await req.json());

    const availability = await prisma.availability.create({
      data: {
        instructorId: id,
        dayOfWeek: parsed.dayOfWeek,
        startTime: parsed.startTime,
        endTime: parsed.endTime,
      },
    });

    return NextResponse.json(availability, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors }, { status: 400 });
    }
    console.error("Create availability error:", err);
    return NextResponse.json(
      { error: "Failed to create availability" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { error } = await authorizeInstructor(id);
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const availabilityId = searchParams.get("availabilityId");
  if (!availabilityId) {
    return NextResponse.json({ error: "availabilityId required" }, { status: 400 });
  }

  await prisma.availability.deleteMany({
    where: { id: availabilityId, instructorId: id },
  });
  return NextResponse.json({ deleted: true });
}
