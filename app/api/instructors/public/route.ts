import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

export async function GET() {
  const instructors = await prisma.instructor.findMany({
    where: { active: true, acceptsNewLearners: true },
    select: {
      id: true,
      bio: true,
      vehicleType: true,
      transmission: true,
      basePostcode: true,
      servicePostcodes: true,
      hourlyRatePence: true,
      lessonDurationMinutes: true,
      offersIntensive: true,
      user: { select: { name: true } },
    },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(instructors);
}
