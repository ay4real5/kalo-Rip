"use client";

import { useEffect, useState } from "react";
import { formatCalendarDate } from "@/app/lib/timezone";
import { Card, CardHeader, CardTitle, CardDescription } from "@/app/components/ui/Card";
import { Button } from "@/app/components/ui/Button";
import { useToast } from "@/app/components/ToastProvider";
import { CalendarOff, Plus, Trash2, Loader2 } from "lucide-react";

interface Blackout {
  id: string;
  date: string;
  reason: string | null;
}

export function BlackoutsTab({ instructorId }: { instructorId: string }) {
  const { showToast } = useToast();
  const [blackouts, setBlackouts] = useState<Blackout[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ date: "", reason: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/instructors/${instructorId}/blackouts`)
      .then((r) => r.json())
      .then((data) => {
        setBlackouts(data);
        setLoading(false);
      });
  }, [instructorId]);

  async function addBlackout(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch(`/api/instructors/${instructorId}/blackouts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: form.date, reason: form.reason || undefined }),
    });
    if (res.ok) {
      const created = await res.json();
      setBlackouts((prev) => [...prev, created].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()));
      setForm({ date: "", reason: "" });
      showToast("Time off added", "success");
    } else {
      showToast("Failed to add time off", "error");
    }
    setSaving(false);
  }

  async function removeBlackout(id: string) {
    const res = await fetch(`/api/instructors/${instructorId}/blackouts?blackoutId=${id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setBlackouts((prev) => prev.filter((b) => b.id !== id));
      showToast("Time off removed", "success");
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-2" padding="none">
        <div className="border-b border-slate-200 px-6 py-4 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <CalendarOff size={20} className="text-emerald-600" />
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Time off / blackouts</h2>
          </div>
        </div>
        <div className="px-6 py-4">
          {loading ? (
            <div className="h-32 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-700" />
          ) : blackouts.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50/50 py-12 text-slate-500 dark:border-slate-600 dark:bg-slate-800/50 dark:text-slate-400">
              <CalendarOff size={32} className="mb-3 opacity-40" />
              <p className="font-medium">No time off scheduled</p>
              <p className="text-sm">Add a date you are unavailable.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {blackouts.map((b) => (
                <div
                  key={b.id}
                  className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/50 p-4 dark:border-slate-700 dark:bg-slate-800/50"
                >
                  <div>
                    <div className="font-semibold text-slate-900 dark:text-slate-100">
                      {formatCalendarDate(new Date(b.date))}
                    </div>
                    {b.reason && <div className="text-sm text-slate-500 dark:text-slate-400">{b.reason}</div>}
                  </div>
                  <button
                    onClick={() => removeBlackout(b.id)}
                    className="flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-medium text-red-600 transition hover:bg-red-50"
                  >
                    <Trash2 size={14} />
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      <Card padding="md">
        <CardHeader className="px-0 pb-4">
          <CardTitle className="text-lg">Add time off</CardTitle>
          <CardDescription>Block out a full day you cannot teach</CardDescription>
        </CardHeader>
        <form onSubmit={addBlackout} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">Date</label>
            <input
              type="date"
              required
              className="w-full rounded-xl border-slate-200 bg-slate-50 p-2.5 text-sm focus:border-emerald-500 focus:ring-emerald-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">Reason (optional)</label>
            <input
              className="w-full rounded-xl border-slate-200 bg-slate-50 p-2.5 text-sm focus:border-emerald-500 focus:ring-emerald-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              placeholder="Holiday, sick, etc."
            />
          </div>
          <Button type="submit" className="w-full" disabled={saving} icon={saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}>
            {saving ? "Adding..." : "Add time off"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
