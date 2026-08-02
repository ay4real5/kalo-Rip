"use client";

import { useEffect, useState } from "react";
import { Card } from "@/app/components/ui/Card";
import { Badge } from "@/app/components/ui/Badge";
import { CalendarDays, Clock, User, Phone } from "lucide-react";

interface Booking {
  id: string;
  startsAt: string;
  endsAt: string;
  status: string;
  lessonType: string;
  notes: string | null;
  customer: { user: { name: string | null; phone: string | null; email: string } };
}

export function BookingsTab({ instructorId }: { instructorId: string }) {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/instructors/${instructorId}/bookings`)
      .then((r) => r.json())
      .then((data) => {
        setBookings(data);
        setLoading(false);
      });
  }, [instructorId]);

  const now = new Date();
  const upcoming = bookings.filter((b) => new Date(b.startsAt) >= now && b.status === "CONFIRMED");
  const past = bookings.filter((b) => new Date(b.startsAt) < now || b.status !== "CONFIRMED");

  if (loading) {
    return (
      <Card padding="md">
        <div className="h-64 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-700" />
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card padding="none" className="overflow-hidden">
        <div className="border-b border-slate-200 px-6 py-4 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <CalendarDays size={20} className="text-emerald-600" />
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Upcoming lessons</h2>
            <Badge variant="primary">{upcoming.length}</Badge>
          </div>
        </div>
        <div className="px-6 py-4">
          {upcoming.length === 0 ? (
            <p className="py-8 text-center text-slate-500 dark:text-slate-400">No upcoming lessons.</p>
          ) : (
            <div className="space-y-3">
              {upcoming.map((b) => (
                <BookingRow key={b.id} booking={b} />
              ))}
            </div>
          )}
        </div>
      </Card>

      {past.length > 0 && (
        <Card padding="none" className="overflow-hidden">
          <div className="border-b border-slate-200 px-6 py-4 dark:border-slate-700">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Past lessons</h2>
          </div>
          <div className="px-6 py-4">
            <div className="space-y-3">
              {past.slice(0, 20).map((b) => (
                <BookingRow key={b.id} booking={b} />
              ))}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

function BookingRow({ booking }: { booking: Booking }) {
  const start = new Date(booking.startsAt);
  return (
    <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
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
              {booking.customer.user.name ?? booking.customer.user.email}
            </span>
            {booking.customer.user.phone && (
              <span className="flex items-center gap-1">
                <Phone size={12} />
                {booking.customer.user.phone}
              </span>
            )}
          </div>
          {booking.notes && (
            <p className="mt-1 text-xs text-slate-400">{booking.notes}</p>
          )}
        </div>
      </div>
      <div className="flex flex-col items-end gap-1">
        <Badge variant={booking.status === "CONFIRMED" ? "success" : "neutral"} dot>
          {booking.status}
        </Badge>
        <span className="text-xs capitalize text-slate-400">{booking.lessonType.toLowerCase()}</span>
      </div>
    </div>
  );
}
