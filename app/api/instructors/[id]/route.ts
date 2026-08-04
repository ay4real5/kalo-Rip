import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireUser } from "@/app/lib/auth/server";
import { authorizeInstructor } from "@/app/lib/auth/api";
import { z } from "zod";

const updateSchema = z.object({
  bio: z.string().optional(),
  phone: z.string().optional(),
  vehicleType: z.string().optional(),
  transmission: z.enum(["MANUAL", "AUTOMATIC", "BOTH"]).optional(),
  basePostcode: z.string().optional(),
  servicePostcodes: z.array(z.string()).optional(),
  lessonDurationMinutes: z.number().min(30).optional(),
  travelBufferMinutes: z.number().min(0).optional(),
  maxLessonsPerDay: z.number().min(1).optional(),
  hourlyRatePence: z.number().min(0).optional(),
  acceptsNewLearners: z.boolean().optional(),
  offersIntensive: z.boolean().optional(),
  active: z.boolean().optional(),
});

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;

    const instructor = await prisma.instructor.findUnique({
      where: { id },
      include: { user: true },
    });
    if (!instructor) {
      return NextResponse.json({ error: "Instructor not found" }, { status: 404 });
    }

    const isOwner = instructor.userId === user.id;
    const isAdmin = user.role === "ADMIN";
    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = updateSchema.parse(body);

    const updated = await prisma.instructor.update({
      where: { id },
      data: parsed,
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    console.error("Update instructor error:", error);
    return NextResponse.json({ error: "Failed to update instructor" }, { status: 500 });
  }
}

// Full instructor record including staff contact details — scoped to the
// instructor themselves or an admin. The customer-facing profile is
// GET /api/instructors/public.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { error } = await authorizeInstructor(id);
    if (error) return error;

    const instructor = await prisma.instructor.findUnique({
      where: { id },
      include: { user: true },
    });
    if (!instructor) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(instructor);
  } catch (error) {
    console.error("Get instructor error:", error);
    return NextResponse.json({ error: "Failed to fetch instructor" }, { status: 500 });
  }
}
