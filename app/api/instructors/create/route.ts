import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireUser } from "@/app/lib/auth/server";
import { z } from "zod";

const schema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  basePostcode: z.string().min(1),
  servicePostcodes: z.array(z.string()).default([]),
  transmission: z.enum(["MANUAL", "AUTOMATIC", "BOTH"]).default("MANUAL"),
  vehicleType: z.string().optional(),
  hourlyRatePence: z.number().min(0).default(3000),
  lessonDurationMinutes: z.number().min(30).default(60),
});

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    if (user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = schema.parse(body);

    // Create a User record (no password — they will need to sign up via Supabase
    // with the same email, or we can invite them). We store it so the admin can
    // manage them and so the Instructor can be linked.
    let dbUser = await prisma.user.findUnique({ where: { email: parsed.email } });
    if (!dbUser) {
      dbUser = await prisma.user.create({
        data: {
          email: parsed.email,
          name: parsed.name,
          phone: parsed.phone,
          role: "INSTRUCTOR",
        },
      });
    }

    const existingInstructor = await prisma.instructor.findUnique({
      where: { userId: dbUser.id },
    });
    if (existingInstructor) {
      return NextResponse.json({ error: "Instructor already exists for this user" }, { status: 409 });
    }

    const instructor = await prisma.instructor.create({
      data: {
        userId: dbUser.id,
        basePostcode: parsed.basePostcode,
        servicePostcodes: parsed.servicePostcodes.length > 0 ? parsed.servicePostcodes : [parsed.basePostcode.split(" ")[0]],
        transmission: parsed.transmission,
        vehicleType: parsed.vehicleType,
        hourlyRatePence: parsed.hourlyRatePence,
        lessonDurationMinutes: parsed.lessonDurationMinutes,
      },
      include: { user: true },
    });

    return NextResponse.json(instructor, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    console.error("Create instructor error:", error);
    return NextResponse.json({ error: "Failed to create instructor" }, { status: 500 });
  }
}
