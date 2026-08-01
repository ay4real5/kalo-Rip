import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

export async function GET() {
  const calls = await prisma.callLog.findMany({
    include: { customer: { include: { user: true } } },
    orderBy: { startedAt: "desc" },
    take: 100,
  });
  return NextResponse.json(calls);
}
