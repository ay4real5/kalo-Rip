"use client";

import { useState } from "react";
import { createClient } from "@/app/lib/supabase/client";
import { Button } from "@/app/components/ui/Button";
import { Card } from "@/app/components/ui/Card";
import { Mail, Loader2, ArrowLeft, CheckCircle2 } from "lucide-react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setSent(true);
    setLoading(false);
  }

  return (
    <div className="flex min-h-[calc(100vh-64px)] items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Reset your password</h1>
          <p className="mt-2 text-slate-600 dark:text-slate-400">We will email you a reset link.</p>
        </div>

        <Card padding="lg">
          {sent ? (
            <div className="text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600 dark:bg-emerald-900">
                <CheckCircle2 size={32} />
              </div>
              <p className="mt-4 font-semibold text-slate-900 dark:text-slate-100">Check your email</p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                We sent a reset link to {email}.
              </p>
              <Link href="/login" className="mt-6 inline-flex items-center gap-1 text-sm font-medium text-emerald-600 hover:text-emerald-700 dark:text-emerald-400">
                <ArrowLeft size={16} /> Back to sign in
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Email address
                </label>
                <div className="relative">
                  <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full rounded-xl border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm focus:border-emerald-500 focus:ring-emerald-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500"
                  />
                </div>
              </div>

              {error && (
                <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
                  {error}
                </div>
              )}

              <Button type="submit" className="w-full" disabled={loading} icon={loading ? <Loader2 size={18} className="animate-spin" /> : undefined}>
                {loading ? "Sending..." : "Send reset link"}
              </Button>
            </form>
          )}

          <div className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
            <Link href="/login" className="inline-flex items-center gap-1 font-medium text-emerald-600 hover:text-emerald-700 dark:text-emerald-400">
              <ArrowLeft size={14} /> Back to sign in
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
