import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireUser } from "@/app/lib/auth/server";

const PAGE_SIZE = 50;

export async function GET(request: Request) {
  await requireUser();

  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));

  const [instructors, total] = await Promise.all([
    prisma.instructor.findMany({
      include: {
        user: { select: { id: true, name: true, email: true, phone: true } },
        availability: true,
        blackoutDates: true,
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.instructor.count(),
  ]);

  return NextResponse.json({
    items: instructors,
    total,
    page,
    pageSize: PAGE_SIZE,
    totalPages: Math.ceil(total / PAGE_SIZE),
  });
}
