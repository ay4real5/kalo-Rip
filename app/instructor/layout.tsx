import { requireRole } from "@/app/lib/auth/server";

export default async function InstructorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireRole(["ADMIN", "INSTRUCTOR"]);
  return <>{children}</>;
}
