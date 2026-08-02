import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireUser } from "@/app/lib/auth/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;

    const instructor = await prisma.instructor.findUnique({ where: { id } });
    if (!instructor) {
      return NextResponse.json({ error: "Instructor not found" }, { status: 404 });
    }

    // Allow the instructor themselves or an admin
    if (instructor.userId !== user.id && user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const bookings = await prisma.booking.findMany({
      where: { instructorId: id },
      include: {
        customer: { include: { user: true } },
      },
      orderBy: { startsAt: "asc" },
    });

    return NextResponse.json(bookings);
  } catch (error) {
    console.error("Get instructor bookings error:", error);
    return NextResponse.json({ error: "Failed to fetch bookings" }, { status: 500 });
  }
}
