/**
 * Promote an existing account to ADMIN.
 *
 *   npm run grant-admin -- you@example.com
 *
 * Why this exists: roles are assigned server-side and the only automatic ADMIN
 * is the very first user ever registered. Once the table has rows — after a
 * seed, say — there is no route to an admin account through the UI, and the
 * dashboard becomes unreachable. This is the deliberate way out.
 *
 * Sign up at /register first. That creates the Supabase auth account and a
 * User row carrying its id; this only changes the role on that row. It cannot
 * create a login, because promoting a row with no auth account behind it just
 * produces an admin nobody can sign in as — the exact problem it is here to
 * fix, so it refuses to do that.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/** Supabase auth ids are UUIDs; seeded rows use cuids. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function fail(message: string): never {
  console.error(`\n${message}\n`);
  process.exit(1);
}

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();

  if (!email) {
    fail(
      "Usage: npm run grant-admin -- you@example.com\n\n" +
        "Pass the email address of an account that has already signed up."
    );
  }

  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    fail(
      `No account found for ${email}.\n\n` +
        "Sign up at /register with that address first — that creates the login.\n" +
        "This script only changes the role on an account that already exists."
    );
  }

  if (!UUID.test(user.id)) {
    fail(
      `${email} exists, but it is not linked to a login.\n\n` +
        `Its id (${user.id}) is not a Supabase auth id, so it was created by the\n` +
        "seed script rather than by signing up. Promoting it would give you an\n" +
        "admin nobody can sign in as.\n\n" +
        "Sign up at /register with a different address, then run this again."
    );
  }

  if (user.role === "ADMIN") {
    console.log(`\n${email} is already an ADMIN. Nothing to do.\n`);
    return;
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { role: "ADMIN" },
  });

  console.log(
    `\n${updated.email} promoted from ${user.role} to ${updated.role}.\n\n` +
      "Sign in at /login — /admin should now load.\n"
  );
}

main()
  .catch((error) => {
    console.error("\ngrant-admin failed:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
