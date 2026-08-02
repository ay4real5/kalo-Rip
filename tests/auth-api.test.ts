import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The authorisation helpers behind every API route. These encode the rules the
 * security fixes introduced, so a regression here silently reopens the holes:
 * unauthenticated reads, customers reading staff data, and instructors acting
 * on each other's records.
 */

let currentUser: { id: string; role: string } | null = null;
let instructorRow: { userId: string } | null = null;

vi.mock("@/app/lib/auth/server", () => ({
  getUser: async () => currentUser,
}));

vi.mock("@/app/lib/prisma", () => ({
  prisma: {
    instructor: { findUnique: async () => instructorRow },
  },
}));

const { authorize, authorizeInstructor } = await import("@/app/lib/auth/api");

const ADMIN = { id: "user-admin", role: "ADMIN" };
const INSTRUCTOR = { id: "user-inst", role: "INSTRUCTOR" };
const OTHER_INSTRUCTOR = { id: "user-inst-2", role: "INSTRUCTOR" };
const CUSTOMER = { id: "user-cust", role: "CUSTOMER" };

beforeEach(() => {
  currentUser = null;
  instructorRow = null;
});

describe("authorize", () => {
  it("rejects an anonymous request with 401", async () => {
    const { user, error } = await authorize();
    expect(user).toBeNull();
    expect(error?.status).toBe(401);
  });

  it("returns 401, never a redirect", async () => {
    // requireUser() redirects, and the try/catch in every route swallows the
    // NEXT_REDIRECT sentinel and reports a 500. API routes must not do that.
    const { error } = await authorize();
    expect(error?.status).toBe(401);
    expect(error?.headers.get("location")).toBeNull();
    await expect(error!.json()).resolves.toEqual({ error: "Unauthorized" });
  });

  it("admits any signed-in user when no role is required", async () => {
    currentUser = CUSTOMER;
    const { user, error } = await authorize();
    expect(error).toBeNull();
    expect(user?.id).toBe("user-cust");
  });

  it("rejects a customer from an admin-only route with 403", async () => {
    currentUser = CUSTOMER;
    const { user, error } = await authorize(["ADMIN"]);
    expect(user).toBeNull();
    expect(error?.status).toBe(403);
  });

  it("rejects an instructor from an admin-only route", async () => {
    currentUser = INSTRUCTOR;
    expect((await authorize(["ADMIN"])).error?.status).toBe(403);
  });

  it("admits a listed role", async () => {
    currentUser = INSTRUCTOR;
    expect((await authorize(["ADMIN", "INSTRUCTOR"])).error).toBeNull();

    currentUser = ADMIN;
    expect((await authorize(["ADMIN"])).error).toBeNull();
  });
});

describe("authorizeInstructor", () => {
  it("lets an admin act on anyone", async () => {
    currentUser = ADMIN;
    instructorRow = { userId: "user-inst" };
    expect((await authorizeInstructor("inst-1")).error).toBeNull();
  });

  it("lets an instructor act on their own record", async () => {
    currentUser = INSTRUCTOR;
    instructorRow = { userId: "user-inst" };
    expect((await authorizeInstructor("inst-1")).error).toBeNull();
  });

  it("stops an instructor acting on someone else's record", async () => {
    // The hole this closes: any instructor could rewrite a rival's working
    // hours, and the booking engine sells against whatever those rows say.
    currentUser = OTHER_INSTRUCTOR;
    instructorRow = { userId: "user-inst" };
    const { user, error } = await authorizeInstructor("inst-1");
    expect(user).toBeNull();
    expect(error?.status).toBe(403);
  });

  it("stops a customer entirely", async () => {
    currentUser = CUSTOMER;
    instructorRow = { userId: "user-cust" };
    expect((await authorizeInstructor("inst-1")).error?.status).toBe(403);
  });

  it("rejects anonymous requests", async () => {
    expect((await authorizeInstructor("inst-1")).error?.status).toBe(401);
  });

  it("gives the same 403 for a missing instructor, so ids can't be probed", async () => {
    currentUser = INSTRUCTOR;
    instructorRow = null;
    const { error } = await authorizeInstructor("does-not-exist");
    expect(error?.status).toBe(403);
    await expect(error!.json()).resolves.toEqual({ error: "Forbidden" });
  });
});
