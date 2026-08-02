import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { authorize } from "@/app/lib/auth/api";

const PAGE_SIZE = 50;

// Staff roster with contact details — not for customers. An instructor sees
// only their own record here; the admin dashboard sees everyone. The public
// listing is GET /api/instructors/public.
export async function GET(request: Request) {
  const { user, error } = await authorize(["ADMIN", "INSTRUCTOR"]);
  if (error) return error;

  const scope = user.role === "ADMIN" ? {} : { userId: user.id };

  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));

  const [instructors, total] = await Promise.all([
    prisma.instructor.findMany({
      where: scope,
      include: {
        user: { select: { id: true, name: true, email: true, phone: true } },
        availability: true,
        blackoutDates: true,
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.instructor.count({ where: scope }),
  ]);

  return NextResponse.json({
    items: instructors,
    total,
    page,
    pageSize: PAGE_SIZE,
    totalPages: Math.ceil(total / PAGE_SIZE),
  });
}
