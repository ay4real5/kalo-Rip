import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { authorize } from "@/app/lib/auth/api";

// Call logs hold full conversation transcripts and caller PII, so this is
// admin-only. It was previously unauthenticated.
export async function GET() {
  const { error } = await authorize(["ADMIN"]);
  if (error) return error;

  const calls = await prisma.callLog.findMany({
    include: {
      customer: {
        include: {
          user: { select: { id: true, name: true, phone: true } },
        },
      },
    },
    orderBy: { startedAt: "desc" },
    take: 100,
  });
  return NextResponse.json(calls);
}
