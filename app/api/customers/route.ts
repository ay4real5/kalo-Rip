import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireUser } from "@/app/lib/auth/server";

export async function GET() {
  try {
    await requireUser();
    const customers = await prisma.customer.findMany({
      include: { user: true, bookings: { orderBy: { startsAt: "desc" } } },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(customers);
  } catch (error) {
    console.error("Get customers error:", error);
    return NextResponse.json({ error: "Failed to fetch customers" }, { status: 500 });
  }
}
