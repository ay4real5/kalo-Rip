import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireUser } from "@/app/lib/auth/server";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  type: z.enum(["SINGLE", "BLOCK_5", "BLOCK_10", "INTENSIVE"]).default("SINGLE"),
  lessonCount: z.number().int().min(1).default(1),
  pricePence: z.number().int().min(0),
  active: z.boolean().default(true),
});

export async function GET() {
  const packages = await prisma.lessonPackage.findMany({
    where: { active: true },
    orderBy: { pricePence: "asc" },
  });
  return NextResponse.json(packages);
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    if (user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const body = await request.json();
    const parsed = createSchema.parse(body);

    const pkg = await prisma.lessonPackage.create({
      data: parsed,
    });
    return NextResponse.json(pkg, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    console.error("Create package error:", error);
    return NextResponse.json({ error: "Failed to create package" }, { status: 500 });
  }
}
