import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { authorize } from "@/app/lib/auth/api";

const PAGE_SIZE = 50;

// Admin-only: this is the whole customer book, with contact details. It
// previously required only that you were signed in as *someone*, so any
// customer could page through every other customer.
export async function GET(request: Request) {
  try {
    const { error } = await authorize(["ADMIN"]);
    if (error) return error;

    const url = new URL(request.url);
    const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));
    const search = url.searchParams.get("search") ?? "";

    const where = search
      ? {
          OR: [
            { user: { name: { contains: search, mode: "insensitive" as const } } },
            { user: { email: { contains: search, mode: "insensitive" as const } } },
            { user: { phone: { contains: search } } },
          ],
        }
      : {};

    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        include: { user: true, bookings: { orderBy: { startsAt: "desc" }, take: 5 } },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
      }),
      prisma.customer.count({ where }),
    ]);

    return NextResponse.json({
      items: customers,
      total,
      page,
      pageSize: PAGE_SIZE,
      totalPages: Math.ceil(total / PAGE_SIZE),
    });
  } catch (error) {
    console.error("Get customers error:", error);
    return NextResponse.json({ error: "Failed to fetch customers" }, { status: 500 });
  }
}
