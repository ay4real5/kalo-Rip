import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

export async function GET() {
  const instructors = await prisma.instructor.findMany({
    include: {
      user: { select: { id: true, name: true, email: true, phone: true } },
      availability: true,
      blackoutDates: true,
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(instructors);
}
