"use client";

import { useEffect, useState } from "react";
import {
  CalendarDays,
  Users,
  Phone,
  TrendingUp,
  ArrowUpRight,
  MapPin,
  Car,
  Settings,
  Save,
  Plus,
  XCircle,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import Link from "next/link";
import { Card, CardTitle, CardDescription } from "@/app/components/ui/Card";
import { Badge } from "@/app/components/ui/Badge";
import { Button } from "@/app/components/ui/Button";
import { useToast } from "@/app/components/ToastProvider";
import { Skeleton, SkeletonCard, SkeletonStat } from "@/app/components/ui/Skeleton";
import { cn } from "@/app/lib/cn";

interface Booking {
  id: string;
  startsAt: string;
  endsAt: string;
  status: string;
  lessonType: string;
  source: string;
  customer: { user: { name: string | null; email: string | null; phone: string | null } };
  instructor: { user: { name: string | null } };
}

interface Instructor {
  id: string;
  user: { name: string | null; email: string | null };
  active: boolean;
  acceptsNewLearners: boolean;
  hourlyRatePence: number;
  basePostcode: string;
  vehicleType: string | null;
  transmission: string;
}

interface CallLog {
  id: string;
  fromNumber: string;
  status: string;
  startedAt: string;
  summary: string | null;
}

function formatCurrency(pence: number) {
  return `£${(pence / 100).toFixed(2)}`;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminDashboard() {
  const { showToast } = useToast();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [calls, setCalls] = useState<CallLog[]>([]);
  const [bookingsPage, setBookingsPage] = useState(1);
  const [bookingsTotalPages, setBookingsTotalPages] = useState(1);
  const [tab, setTab] = useState<"overview" | "bookings" | "instructors" | "calls" | "settings" | "calendar">("overview");
  const [loading, setLoading] = useState(true);
  const [handoffNumber, setHandoffNumber] = useState("");
  const [savingHandoff, setSavingHandoff] = useState(false);
  const [reschedule, setReschedule] = useState<{ id: string; startsAt: string } | null>(null);
  const [rescheduleValue, setRescheduleValue] = useState("");
  const [rescheduling, setRescheduling] = useState(false);

  function startReschedule(id: string, currentStartsAt: string) {
    const dt = new Date(currentStartsAt);
    const local = new Date(dt.getTime() - dt.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
    setReschedule({ id, startsAt: currentStartsAt });
    setRescheduleValue(local);
  }

  async function submitReschedule() {
    if (!reschedule) return;
    setRescheduling(true);
    const startsAt = new Date(rescheduleValue);
    const res = await fetch(`/api/bookings/${reschedule.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ startsAt: startsAt.toISOString() }),
    });
    if (res.ok) {
      const updated = await res.json();
      setBookings((prev) =>
        prev.map((b) => (b.id === reschedule.id ? { ...b, startsAt: updated.startsAt, endsAt: updated.endsAt } : b))
      );
      showToast("Booking rescheduled", "success");
      setReschedule(null);
    } else {
      const data = await res.json().catch(() => ({}));
      showToast(data.error || "Failed to reschedule", "error");
    }
    setRescheduling(false);
  }

  async function cancelBooking(id: string) {
    if (!confirm("Are you sure you want to cancel this booking?")) return;
    const res = await fetch(`/api/bookings/${id}`, { method: "DELETE" });
    if (res.ok) {
      setBookings((prev) =>
        prev.map((b) => (b.id === id ? { ...b, status: "CANCELLED" } : b))
      );
      showToast("Booking cancelled", "success");
    } else {
      showToast("Failed to cancel booking", "error");
    }
  }

  async function completeBooking(id: string) {
    const res = await fetch(`/api/bookings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "COMPLETED" }),
    });
    if (res.ok) {
      setBookings((prev) =>
        prev.map((b) => (b.id === id ? { ...b, status: "COMPLETED" } : b))
      );
      showToast("Lesson marked complete", "success");
    } else {
      showToast("Failed to mark complete", "error");
    }
  }

  useEffect(() => {
    Promise.all([
      fetch(`/api/bookings?page=${bookingsPage}`).then((r) => r.json()),
      fetch("/api/instructors").then((r) => r.json()),
      fetch("/api/calls").then((r) => r.json()),
      fetch("/api/settings?key=human_handoff_number").then((r) => r.json()),
    ]).then(([b, i, c, s]) => {
      setBookings(Array.isArray(b) ? b : b.items ?? []);
      setBookingsTotalPages(b.totalPages ?? 1);
      setInstructors(Array.isArray(i) ? i : i.items ?? []);
      setCalls(c);
      setHandoffNumber((s as { value: string | null }).value ?? "");
      setLoading(false);
    });
  }, [bookingsPage]);

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "bookings", label: "Bookings" },
    { id: "calendar", label: "Calendar", href: "/admin/calendar" },
    { id: "customers", label: "Customers", href: "/admin/customers" },
    { id: "analytics", label: "Analytics", href: "/admin/analytics" },
    { id: "instructors", label: "Instructors", href: "/admin/instructors" },
    { id: "calls", label: "Calls" },
    { id: "settings", label: "Settings" },
  ] as const;

  const stats = [
    {
      label: "Total bookings",
      value: bookings.length,
      icon: CalendarDays,
      color: "bg-emerald-50 text-emerald-600",
      trend: "All time",
    },
    {
      label: "Instructors",
      value: instructors.length,
      icon: Users,
      color: "bg-blue-50 text-blue-600",
      trend: `${instructors.filter((i) => i.active).length} active`,
    },
    {
      label: "Recent calls",
      value: calls.length,
      icon: Phone,
      color: "bg-amber-50 text-amber-600",
      trend: "Last 100 calls",
    },
    {
      label: "AI bookings",
      value: bookings.filter((b) => b.source === "PHONE_AI").length,
      icon: TrendingUp,
      color: "bg-violet-50 text-violet-600",
      trend: "Booked by voice AI",
    },
  ];

  if (loading) {
    return (
      <div className="px-6 py-12">
        <div className="mx-auto max-w-6xl">
          <Skeleton className="h-8 w-48" />
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <SkeletonStat key={i} />
            ))}
          </div>
          <div className="mt-8">
            <SkeletonCard lines={6} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-6 py-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Admin dashboard</h1>
            <p className="text-slate-500 dark:text-slate-400">Overview of bookings, instructors and calls.</p>
          </div>
          <Button href="/admin/bookings/new" icon={<Plus size={16} />}>Create booking</Button>
        </div>

        <div className="mb-8 flex flex-wrap gap-2">
          {tabs.map((t) =>
            "href" in t ? (
              <Link
                key={t.id}
                href={t.href}
                className={cn(
                  "rounded-xl px-5 py-2.5 text-sm font-semibold transition-all",
                  tab === t.id
                    ? "bg-slate-900 text-white shadow-md"
                    : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
                )}
              >
                {t.label}
              </Link>
            ) : (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  "rounded-xl px-5 py-2.5 text-sm font-semibold transition-all",
                  tab === t.id
                    ? "bg-slate-900 text-white shadow-md"
                    : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
                )}
              >
                {t.label}
              </button>
            )
          )}
        </div>

        {(tab === "overview" || tab === "bookings") && (
          <>
            <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {stats.map((stat) => (
                <Card key={stat.label} padding="md" className="relative overflow-hidden">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-500">{stat.label}</p>
                      <p className="mt-2 text-3xl font-bold text-slate-900">{stat.value}</p>
                      <p className="mt-1 text-xs text-slate-500">{stat.trend}</p>
                    </div>
                    <div className={cn("rounded-xl p-2.5", stat.color)}>
                      <stat.icon size={20} />
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            <Card padding="none" className="overflow-hidden">
              <div className="border-b border-slate-200 px-6 py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">Recent bookings</CardTitle>
                    <CardDescription>Latest confirmed lessons</CardDescription>
                  </div>
                  <button
                    onClick={() => setTab("bookings")}
                    className="flex items-center gap-1 text-sm font-medium text-emerald-600 hover:text-emerald-700"
                  >
                    View all <ArrowUpRight size={16} />
                  </button>
                </div>
              </div>
              {bookings.length === 0 ? (
                <div className="flex flex-col items-center justify-center px-6 py-16 text-slate-500">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100">
                    <CalendarDays size={28} className="text-slate-400" />
                  </div>
                  <p className="mt-4 font-medium">No bookings yet</p>
                  <p className="mt-1 text-sm">Once callers book lessons they will appear here.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/50 text-xs font-medium text-slate-500">
                        <th className="px-6 py-3">Customer</th>
                        <th className="px-6 py-3">Instructor</th>
                        <th className="px-6 py-3">Time</th>
                        <th className="px-6 py-3">Status</th>
                        <th className="px-6 py-3">Source</th>
                        <th className="px-6 py-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bookings.slice(0, 5).map((b) => (
                        <tr key={b.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50">
                          <td className="px-6 py-4 font-medium text-slate-900">
                            {b.customer.user.name ?? b.customer.user.email ?? "Unknown"}
                          </td>
                          <td className="px-6 py-4 text-slate-700">{b.instructor.user.name ?? "Unknown"}</td>
                          <td className="px-6 py-4 text-slate-700">{formatTime(b.startsAt)}</td>
                          <td className="px-6 py-4">
                            <Badge variant={b.status === "CANCELLED" ? "neutral" : "success"} dot>
                              {b.status}
                            </Badge>
                          </td>
                          <td className="px-6 py-4">
                            <Badge variant={b.source === "PHONE_AI" ? "primary" : "neutral"}>{b.source}</Badge>
                          </td>
                          <td className="px-6 py-4">
                            {b.status !== "CANCELLED" && (
                              <div className="flex items-center gap-3">
                                {b.status === "CONFIRMED" && (
                                  <button
                                    onClick={() => completeBooking(b.id)}
                                    className="flex items-center gap-1 text-sm font-medium text-emerald-600 hover:text-emerald-700"
                                  >
                                    <CheckCircle2 size={14} />
                                    Complete
                                  </button>
                                )}
                                <button
                                  onClick={() => startReschedule(b.id, b.startsAt)}
                                  className="flex items-center gap-1 text-sm font-medium text-emerald-600 hover:text-emerald-700"
                                >
                                  <CalendarDays size={14} />
                                  Reschedule
                                </button>
                                <button
                                  onClick={() => cancelBooking(b.id)}
                                  className="flex items-center gap-1 text-sm font-medium text-red-600 hover:text-red-700"
                                >
                                  <XCircle size={14} />
                                  Cancel
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {bookingsTotalPages > 1 && (
                <div className="flex items-center justify-between border-t border-slate-100 px-6 py-4 dark:border-slate-700">
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Page {bookingsPage} of {bookingsTotalPages}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      onClick={() => setBookingsPage((p) => Math.max(1, p - 1))}
                      disabled={bookingsPage === 1}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => setBookingsPage((p) => Math.min(bookingsTotalPages, p + 1))}
                      disabled={bookingsPage === bookingsTotalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          </>
        )}

        {tab === "instructors" && (
          <Card padding="none" className="overflow-hidden">
            <div className="border-b border-slate-200 px-6 py-4">
              <CardTitle className="text-lg">Instructors</CardTitle>
              <CardDescription>Manage your team and their availability</CardDescription>
            </div>
            {instructors.length === 0 ? (
              <div className="px-6 py-16 text-center text-slate-500">No instructors found.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/50 text-xs font-medium text-slate-500">
                      <th className="px-6 py-3">Instructor</th>
                      <th className="px-6 py-3">Vehicle</th>
                      <th className="px-6 py-3">Base</th>
                      <th className="px-6 py-3">Rate</th>
                      <th className="px-6 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {instructors.map((i) => (
                      <tr key={i.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 font-semibold">
                              {(i.user.name ?? "U")[0]}
                            </div>
                            <div>
                              <div className="font-medium text-slate-900">{i.user.name ?? i.user.email ?? i.id}</div>
                              <div className="text-xs text-slate-500 capitalize">{i.transmission.toLowerCase()}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2 text-slate-700">
                            <Car size={14} />
                            {i.vehicleType ?? "Not set"}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2 text-slate-700">
                            <MapPin size={14} />
                            {i.basePostcode}
                          </div>
                        </td>
                        <td className="px-6 py-4 font-medium text-slate-900">{formatCurrency(i.hourlyRatePence)} / hr</td>
                        <td className="px-6 py-4">
                          {i.active ? (
                            <Badge variant="success" dot>Active</Badge>
                          ) : (
                            <Badge variant="neutral">Inactive</Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        )}

        {tab === "calls" && (
          <Card padding="none" className="overflow-hidden">
            <div className="border-b border-slate-200 px-6 py-4">
              <CardTitle className="text-lg">Recent calls</CardTitle>
              <CardDescription>History of AI-handled and transferred calls</CardDescription>
            </div>
            {calls.length === 0 ? (
              <div className="flex flex-col items-center px-6 py-16 text-slate-500">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100">
                  <Phone size={28} className="text-slate-400" />
                </div>
                <p className="mt-4 font-medium">No calls yet</p>
                <p className="mt-1 text-sm">Once your Twilio number is live, calls will appear here.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {calls.map((c) => (
                  <div key={c.id} className="px-6 py-4 hover:bg-slate-50/50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600">
                          <Phone size={16} />
                        </div>
                        <div>
                          <div className="font-medium text-slate-900">{c.fromNumber}</div>
                          <div className="text-xs text-slate-500">{new Date(c.startedAt).toLocaleString("en-GB")}</div>
                        </div>
                      </div>
                      <Badge
                        variant={
                          c.status === "HANDED_OFF"
                            ? "warning"
                            : c.status === "COMPLETED"
                            ? "success"
                            : "neutral"
                        }
                        dot
                      >
                        {c.status}
                      </Badge>
                    </div>
                    {c.summary && <p className="mt-2 pl-14 text-sm text-slate-600">{c.summary}</p>}
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        {tab === "settings" && (
          <Card padding="lg">
            <div className="mb-6 flex items-center gap-2">
              <div className="rounded-lg bg-emerald-50 p-2 text-emerald-600">
                <Settings size={20} />
              </div>
              <div>
                <CardTitle className="text-lg">Settings</CardTitle>
                <CardDescription>Configure voice and business options</CardDescription>
              </div>
            </div>

            <div className="max-w-md">
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                Human handoff number
              </label>
              <p className="mb-3 text-sm text-slate-500">
                Calls are transferred to this number when the AI cannot help or the caller asks for a human.
              </p>
              <div className="flex gap-3">
                <input
                  type="tel"
                  value={handoffNumber}
                  onChange={(e) => setHandoffNumber(e.target.value)}
                  placeholder="+44 7123 456789"
                  className="flex-1 rounded-xl border-slate-200 bg-slate-50 p-2.5 text-sm focus:border-emerald-500 focus:ring-emerald-500"
                />
                <Button
                  onClick={async () => {
                    setSavingHandoff(true);
                    const res = await fetch("/api/settings", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ key: "human_handoff_number", value: handoffNumber }),
                    });
                    setSavingHandoff(false);
                    if (res.ok) showToast("Handoff number saved", "success");
                    else showToast("Failed to save handoff number", "error");
                  }}
                  disabled={savingHandoff}
                  icon={savingHandoff ? undefined : <Save size={16} />}
                >
                  {savingHandoff ? "Saving..." : "Save"}
                </Button>
              </div>
            </div>
          </Card>
        )}

        {reschedule && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-6">
            <Card padding="lg" className="w-full max-w-md">
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Reschedule booking</h3>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Currently: {new Date(reschedule.startsAt).toLocaleString("en-GB")}
              </p>
              <div className="mt-6">
                <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">New date & time</label>
                <input
                  type="datetime-local"
                  value={rescheduleValue}
                  onChange={(e) => setRescheduleValue(e.target.value)}
                  className="w-full rounded-xl border-slate-200 bg-slate-50 p-2.5 text-sm focus:border-emerald-500 focus:ring-emerald-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <Button variant="secondary" onClick={() => setReschedule(null)} disabled={rescheduling}>
                  Cancel
                </Button>
                <Button onClick={submitReschedule} disabled={rescheduling} icon={rescheduling ? <Loader2 size={16} className="animate-spin" /> : undefined}>
                  {rescheduling ? "Saving..." : "Reschedule"}
                </Button>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
