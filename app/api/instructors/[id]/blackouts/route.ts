import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireUser } from "@/app/lib/auth/server";
import { z } from "zod";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireUser();
    const { id } = await params;
    const blackouts = await prisma.blackoutDate.findMany({
      where: { instructorId: id },
      orderBy: { date: "asc" },
    });
    return NextResponse.json(blackouts);
  } catch (error) {
    console.error("Get blackouts error:", error);
    return NextResponse.json({ error: "Failed to fetch blackouts" }, { status: 500 });
  }
}

const createSchema = z.object({
  date: z.string(),
  reason: z.string().optional(),
});

export async function POST(
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
    if (instructor.userId !== user.id && user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = createSchema.parse(body);

    const blackout = await prisma.blackoutDate.create({
      data: {
        instructorId: id,
        date: new Date(parsed.date),
        reason: parsed.reason,
      },
    });

    return NextResponse.json(blackout, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    console.error("Create blackout error:", error);
    return NextResponse.json({ error: "Failed to create blackout" }, { status: 500 });
  }
}

export async function DELETE(
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
    if (instructor.userId !== user.id && user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const url = new URL(request.url);
    const blackoutId = url.searchParams.get("blackoutId");
    if (!blackoutId) {
      return NextResponse.json({ error: "blackoutId required" }, { status: 400 });
    }

    await prisma.blackoutDate.deleteMany({ where: { id: blackoutId, instructorId: id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete blackout error:", error);
    return NextResponse.json({ error: "Failed to delete blackout" }, { status: 500 });
  }
}
