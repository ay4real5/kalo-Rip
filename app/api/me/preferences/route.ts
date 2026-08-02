import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireUser } from "@/app/lib/auth/server";
import { z } from "zod";

const updateSchema = z.object({
  smsOptIn: z.boolean().optional(),
  emailOptIn: z.boolean().optional(),
});

export async function GET() {
  try {
    const user = await requireUser();
    const customer = await prisma.customer.findUnique({
      where: { userId: user.id },
      select: { smsOptIn: true, emailOptIn: true },
    });
    if (!customer) {
      return NextResponse.json({ error: "No customer profile" }, { status: 404 });
    }
    return NextResponse.json(customer);
  } catch (error) {
    console.error("Get preferences error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireUser();
    const body = await request.json();
    const parsed = updateSchema.parse(body);

    const customer = await prisma.customer.findUnique({
      where: { userId: user.id },
    });
    if (!customer) {
      return NextResponse.json({ error: "No customer profile" }, { status: 404 });
    }

    const updated = await prisma.customer.update({
      where: { id: customer.id },
      data: parsed,
      select: { smsOptIn: true, emailOptIn: true },
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    console.error("Update preferences error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
