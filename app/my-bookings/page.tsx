"use client";

import { useEffect, useState } from "react";
import { Card } from "@/app/components/ui/Card";
import { Button } from "@/app/components/ui/Button";
import { Badge } from "@/app/components/ui/Badge";
import { useToast } from "@/app/components/ToastProvider";
import { CalendarDays, Clock, User, XCircle, Loader2 } from "lucide-react";

interface MyBooking {
  id: string;
  startsAt: string;
  endsAt: string;
  status: string;
  lessonType: string;
  notes: string | null;
  instructor: { user: { name: string | null } };
}

export default function MyBookingsPage() {
  const { showToast } = useToast();
  const [bookings, setBookings] = useState<MyBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/me/bookings")
      .then((r) => r.json())
      .then((data) => {
        setBookings(data);
        setLoading(false);
      });
  }, []);

  async function cancelBooking(id: string) {
    if (!confirm("Cancel this booking?")) return;
    setCancellingId(id);
    const res = await fetch(`/api/bookings/${id}`, { method: "DELETE" });
    if (res.ok) {
      setBookings((prev) =>
        prev.map((b) => (b.id === id ? { ...b, status: "CANCELLED" } : b))
      );
      showToast("Booking cancelled", "success");
    } else {
      showToast("Failed to cancel booking", "error");
    }
    setCancellingId(null);
  }

  if (loading) {
    return (
      <div className="px-6 py-12">
        <div className="mx-auto max-w-3xl">
          <div className="h-8 w-48 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-700" />
          <div className="mt-8 space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-700" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const now = new Date();
  const upcoming = bookings.filter((b) => new Date(b.startsAt) >= now && b.status === "CONFIRMED");
  const past = bookings.filter((b) => new Date(b.startsAt) < now || b.status !== "CONFIRMED");

  return (
    <div className="px-6 py-12">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">My bookings</h1>
          <p className="mt-2 text-slate-600 dark:text-slate-400">View and cancel your driving lessons.</p>
        </div>

        {upcoming.length === 0 && past.length === 0 ? (
          <Card padding="lg" className="text-center">
            <CalendarDays size={40} className="mx-auto text-slate-300" />
            <p className="mt-4 text-slate-500 dark:text-slate-400">You have no bookings yet.</p>
            <Button href="/book" className="mt-6" variant="primary">Book a lesson</Button>
          </Card>
        ) : (
          <div className="space-y-8">
            {upcoming.length > 0 && (
              <div>
                <h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-slate-100">Upcoming</h2>
                <div className="space-y-3">
                  {upcoming.map((b) => (
                    <BookingCard key={b.id} booking={b} onCancel={cancelBooking} cancelling={cancellingId === b.id} />
                  ))}
                </div>
              </div>
            )}

            {past.length > 0 && (
              <div>
                <h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-slate-100">Past</h2>
                <div className="space-y-3">
                  {past.slice(0, 20).map((b) => (
                    <BookingCard key={b.id} booking={b} onCancel={cancelBooking} cancelling={cancellingId === b.id} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function BookingCard({
  booking,
  onCancel,
  cancelling,
}: {
  booking: MyBooking;
  onCancel: (id: string) => void;
  cancelling: boolean;
}) {
  const start = new Date(booking.startsAt);
  const isPast = start < new Date() || booking.status !== "CONFIRMED";

  return (
    <Card padding="md">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">
            <Clock size={20} />
          </div>
          <div>
            <div className="font-semibold text-slate-900 dark:text-slate-100">
              {start.toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
            </div>
            <div className="flex items-center gap-3 text-sm text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1">
                <User size={12} />
                {booking.instructor.user.name ?? "Instructor"}
              </span>
              <span className="capitalize">{booking.lessonType.toLowerCase()}</span>
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <Badge variant={booking.status === "CONFIRMED" ? "success" : "neutral"} dot>
            {booking.status}
          </Badge>
          {!isPast && (
            <button
              onClick={() => onCancel(booking.id)}
              disabled={cancelling}
              className="flex items-center gap-1 text-xs font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
            >
              {cancelling ? <Loader2 size={12} className="animate-spin" /> : <XCircle size={12} />}
              Cancel
            </button>
          )}
        </div>
      </div>
    </Card>
  );
}
