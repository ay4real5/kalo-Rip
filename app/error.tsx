"use client";

import { useEffect } from "react";
import { Button } from "@/app/components/ui/Button";
import { AlertTriangle, RotateCcw } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[calc(100vh-64px)] flex-col items-center justify-center px-6 py-12 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-100 text-red-600 dark:bg-red-900">
        <AlertTriangle size={32} />
      </div>
      <h1 className="mt-6 text-2xl font-bold text-slate-900 dark:text-slate-100">Something went wrong</h1>
      <p className="mt-2 max-w-md text-slate-600 dark:text-slate-400">
        An unexpected error occurred. Please try again.
      </p>
      <Button onClick={reset} icon={<RotateCcw size={16} />} className="mt-8" variant="primary">
        Try again
      </Button>
    </div>
  );
}
