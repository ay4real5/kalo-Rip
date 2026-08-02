import Link from "next/link";
import { Button } from "@/app/components/ui/Button";
import { ShieldAlert } from "lucide-react";

export default function UnauthorizedPage() {
  return (
    <div className="flex min-h-[calc(100vh-64px)] flex-col items-center justify-center px-6 py-12">
      <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-red-100 text-red-600">
        <ShieldAlert size={40} />
      </div>
      <h1 className="mt-6 text-2xl font-bold text-slate-900">Access denied</h1>
      <p className="mt-2 max-w-md text-center text-slate-600">
        You do not have permission to view this page. Please contact an administrator if you think this is a mistake.
      </p>
      <Link href="/" className="mt-6">
        <Button variant="primary">Go back home</Button>
      </Link>
    </div>
  );
}
