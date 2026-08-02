import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { z } from "zod";

const schema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string().min(1),
  role: z.enum(["ADMIN", "INSTRUCTOR", "CUSTOMER"]),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { id, email, name, role } = schema.parse(body);

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "User already exists" }, { status: 409 });
    }

    const user = await prisma.user.create({
      data: {
        id,
        email,
        name,
        role,
      },
    });

    if (role === "INSTRUCTOR") {
      await prisma.instructor.create({
        data: {
          userId: user.id,
          basePostcode: "SW1A 1AA",
          servicePostcodes: ["SW1A 1AA"],
        },
      });
    }

    return NextResponse.json(user, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    console.error("Registration error:", error);
    return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
  }
}
