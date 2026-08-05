"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/app/components/ui/Card";
import { Button } from "@/app/components/ui/Button";
import { Badge } from "@/app/components/ui/Badge";
import { useToast } from "@/app/components/ToastProvider";
import { SkeletonCard } from "@/app/components/ui/Skeleton";
import { SCHOOL_TIMEZONE } from "@/app/lib/timezone";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Loader2,
  MapPin,
  Phone,
  UserCheck,
} from "lucide-react";

interface EligibleInstructor {
  instructorId: string;
  instructorName: string;
  pricePence: number;
  vehicleType: string | null;
}

interface PendingBooking {
  id: string;
  startsAt: string;
  endsAt: string;
  lessonType: string;
  source: string;
  notes: string | null;
  pricePence: number;
  customer: {
    postcode: string;
    transmission: string;
    user: { name: string | null; phone: string | null; email: string | null };
  };
  eligibleInstructors: EligibleInstructor[];
}

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    timeZone: SCHOOL_TIMEZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export default function AssignmentsPage() {
  const { showToast } = useToast();
  const [items, setItems] = useState<PendingBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState<string | null>(null);
  const [choice, setChoice] = useState<Record<string, string>>({});

  // Bumped to re-fetch. State is only set from inside the promise callbacks,
  // never synchronously in the effect body.
  const [refreshKey, setRefreshKey] = useState(0);
  const reload = useCallback(() => setRefreshKey((k) => k + 1), []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/bookings/pending")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("request failed"))))
      .then((data: { items?: PendingBooking[] }) => {
        if (cancelled) return;
        setItems(data.items ?? []);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setLoading(false);
        showToast("Failed to load the assignment queue", "error");
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey, showToast]);

  async function assign(bookingId: string) {
    const instructorId = choice[bookingId];
    if (!instructorId) {
      showToast("Pick an instructor first", "info");
      return;
    }
    setAssigning(bookingId);
    const res = await fetch(`/api/bookings/${bookingId}/assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ instructorId }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      showToast("Instructor assigned — the learner has been told", "success");
      setItems((prev) => prev.filter((b) => b.id !== bookingId));
    } else {
      // Most likely someone else took the slot while this page was open, so
      // reload rather than leaving a stale list on screen.
      showToast(data.error || "Failed to assign", "error");
      reload();
    }
    setAssigning(null);
  }

  if (loading) {
    return (
      <div className="px-6 py-8">
        <div className="mx-auto max-w-4xl space-y-4">
          <SkeletonCard lines={4} />
          <SkeletonCard lines={4} />
        </div>
      </div>
    );
  }

  return (
    <div className="px-6 py-8">
      <div className="mx-auto max-w-4xl">
        <Link
          href="/admin"
          className="mb-4 flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400"
        >
          <ArrowLeft size={16} /> Back to dashboard
        </Link>

        <div className="mb-6 flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              Assign instructors
            </h1>
            <p className="text-slate-500 dark:text-slate-400">
              Lessons booked by learners, waiting for a driver.
            </p>
          </div>
          <Badge variant={items.length ? "warning" : "success"}>
            {items.length} waiting
          </Badge>
        </div>

        {items.length === 0 ? (
          <Card padding="lg" className="text-center">
            <CheckCircle2 size={40} className="mx-auto text-emerald-500" />
            <p className="mt-4 font-semibold text-slate-900 dark:text-slate-100">
              Nothing waiting
            </p>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Every booked lesson has an instructor.
            </p>
          </Card>
        ) : (
          <div className="space-y-4">
            {items.map((booking) => (
              <Card key={booking.id} padding="lg">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-100">
                      <CalendarDays size={16} className="text-emerald-600" />
                      {formatWhen(booking.startsAt)}
                    </div>
                    <div className="mt-2 space-y-1 text-sm text-slate-600 dark:text-slate-400">
                      <div className="flex items-center gap-2">
                        <UserCheck size={14} />
                        {booking.customer.user.name ?? "Learner"}
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin size={14} />
                        {booking.customer.postcode} ·{" "}
                        {booking.customer.transmission.toLowerCase()}
                      </div>
                      {booking.customer.user.phone && (
                        <div className="flex items-center gap-2">
                          <Phone size={14} />
                          {booking.customer.user.phone}
                        </div>
                      )}
                      {booking.notes && (
                        <div className="text-slate-500">Notes: {booking.notes}</div>
                      )}
                    </div>
                  </div>
                  <Badge variant="neutral">
                    {booking.source === "PHONE_AI" ? "Phone" : "Online"}
                  </Badge>
                </div>

                <div className="mt-5 border-t border-slate-200 pt-4 dark:border-slate-700">
                  {booking.eligibleInstructors.length === 0 ? (
                    // Availability can change after the slot was secured — an
                    // instructor blocks the day out, or takes another lesson.
                    <p className="text-sm text-amber-600 dark:text-amber-400">
                      No instructor is currently free for this slot. Free someone up,
                      or contact the learner to rearrange.
                    </p>
                  ) : (
                    <div className="flex flex-wrap items-center gap-3">
                      <select
                        value={choice[booking.id] ?? ""}
                        onChange={(e) =>
                          setChoice((prev) => ({ ...prev, [booking.id]: e.target.value }))
                        }
                        className="min-w-56 rounded-xl border-slate-200 bg-slate-50 p-2.5 text-sm focus:border-emerald-500 focus:ring-emerald-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                      >
                        <option value="">Choose an instructor…</option>
                        {booking.eligibleInstructors.map((i) => (
                          <option key={i.instructorId} value={i.instructorId}>
                            {i.instructorName}
                            {i.vehicleType ? ` — ${i.vehicleType}` : ""}
                          </option>
                        ))}
                      </select>
                      <Button
                        onClick={() => assign(booking.id)}
                        disabled={assigning === booking.id}
                        icon={
                          assigning === booking.id ? (
                            <Loader2 size={16} className="animate-spin" />
                          ) : (
                            <UserCheck size={16} />
                          )
                        }
                      >
                        {assigning === booking.id ? "Assigning…" : "Assign"}
                      </Button>
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        {booking.eligibleInstructors.length} available
                      </span>
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
