import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireUser } from "@/app/lib/auth/server";

// Returns the authenticated user's bookings (as a customer).
export async function GET() {
  try {
    const user = await requireUser();

    const customer = await prisma.customer.findUnique({
      where: { userId: user.id },
    });
    if (!customer) {
      return NextResponse.json({ error: "No customer profile found" }, { status: 404 });
    }

    const bookings = await prisma.booking.findMany({
      where: { customerId: customer.id },
      include: {
        instructor: { include: { user: true } },
      },
      orderBy: { startsAt: "asc" },
    });

    return NextResponse.json(bookings);
  } catch (error) {
    console.error("Get my bookings error:", error);
    return NextResponse.json({ error: "Failed to fetch bookings" }, { status: 500 });
  }
}
