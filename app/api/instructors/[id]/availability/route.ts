import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const availability = await prisma.availability.findMany({
    where: { instructorId: id },
    orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
  });
  return NextResponse.json(availability);
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = (await req.json()) as {
    dayOfWeek: number;
    startTime: string;
    endTime: string;
  };

  const availability = await prisma.availability.create({
    data: {
      instructorId: id,
      dayOfWeek: body.dayOfWeek,
      startTime: body.startTime,
      endTime: body.endTime,
    },
  });

  return NextResponse.json(availability);
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const availabilityId = searchParams.get("availabilityId");
  if (!availabilityId) {
    return NextResponse.json({ error: "availabilityId required" }, { status: 400 });
  }

  await prisma.availability.deleteMany({
    where: { id: availabilityId, instructorId: id },
  });
  return NextResponse.json({ deleted: true });
}
