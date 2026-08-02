import { NextResponse } from "next/server";
import { getUser } from "@/app/lib/auth/server";
import { prisma } from "@/app/lib/prisma";
import type { User, UserRole } from "@prisma/client";

type AuthResult =
  | { user: User; error: null }
  | { user: null; error: NextResponse };

/**
 * Authenticate, and optionally authorise, an API request.
 *
 * Route handlers must use this rather than `requireUser` / `requireRole`:
 * those call `redirect()`, which throws a NEXT_REDIRECT sentinel that the
 * try/catch in every route swallows and reports as a 500. This returns the
 * response to send instead, so it works inside a try/catch.
 *
 *   const { user, error } = await authorize(["ADMIN"]);
 *   if (error) return error;
 */
export async function authorize(roles?: UserRole[]): Promise<AuthResult> {
  const user = await getUser();

  if (!user) {
    return {
      user: null,
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  if (roles && !roles.includes(user.role)) {
    return {
      user: null,
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { user, error: null };
}

/**
 * Authorise a request that acts on a specific instructor's data. Admins may
 * act on anyone; an instructor may only act on their own record.
 */
export async function authorizeInstructor(
  instructorId: string
): Promise<AuthResult> {
  const { user, error } = await authorize(["ADMIN", "INSTRUCTOR"]);
  if (error) return { user: null, error };

  if (user.role === "ADMIN") return { user, error: null };

  const instructor = await prisma.instructor.findUnique({
    where: { id: instructorId },
    select: { userId: true },
  });

  // Same response whether the instructor is missing or owned by someone else,
  // so this can't be used to enumerate instructor ids.
  if (!instructor || instructor.userId !== user.id) {
    return {
      user: null,
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { user, error: null };
}
