import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { z } from "zod";

// `role` is deliberately NOT accepted from the client. It used to be, which
// let anyone self-register as ADMIN and take over the dashboard. Roles are
// assigned server-side only: the first ever user bootstraps as ADMIN, everyone
// else is a CUSTOMER. Promoting someone to INSTRUCTOR is an admin action via
// POST /api/instructors/create.
const schema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { id, email, name } = schema.parse(body);

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "User already exists" }, { status: 409 });
    }

    const userCount = await prisma.user.count();
    const effectiveRole = userCount === 0 ? "ADMIN" : "CUSTOMER";

    const user = await prisma.user.create({
      data: {
        id,
        email,
        name,
        role: effectiveRole,
      },
    });

    return NextResponse.json(user, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    console.error("Registration error:", error);
    return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
  }
}
