"use client";

import { useEffect, useMemo, useState } from "react";
import { SCHOOL_TIMEZONE } from "@/app/lib/timezone";
import Link from "next/link";
import { Card } from "@/app/components/ui/Card";
import { Button } from "@/app/components/ui/Button";
import { Badge } from "@/app/components/ui/Badge";
import { ChevronLeft, ChevronRight, CalendarDays, ArrowLeft } from "lucide-react";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  isSameMonth,
  isSameDay,
  format,
  addMonths,
  subMonths,
} from "date-fns";

interface Booking {
  id: string;
  startsAt: string;
  status: string;
  lessonType: string;
  source: string;
  customer: { user: { name: string | null } };
  instructor: { user: { name: string | null } };
}

export default function CalendarPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  useEffect(() => {
    fetch("/api/bookings").then((r) => r.json()).then(setBookings);
  }, []);

  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 });
    const days: Date[] = [];
    let cursor = start;
    while (cursor <= end) {
      days.push(cursor);
      cursor = addDays(cursor, 1);
    }
    return days;
  }, [currentMonth]);

  const bookingsByDay = useMemo(() => {
    const map = new Map<string, Booking[]>();
    for (const b of bookings) {
      const date = new Date(b.startsAt).toDateString();
      const list = map.get(date) ?? [];
      list.push(b);
      map.set(date, list);
    }
    return map;
  }, [bookings]);

  const selectedBookings = selectedDate
    ? bookingsByDay.get(selectedDate.toDateString()) ?? []
    : [];

  return (
    <div className="px-6 py-8">
      <div className="mx-auto max-w-6xl">
        <Link href="/admin" className="mb-4 flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-slate-900">
          <ArrowLeft size={16} /> Back to dashboard
        </Link>
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Booking calendar</h1>
            <p className="text-slate-500">View all lessons by month.</p>
          </div>
          <Button href="/admin/bookings/new" variant="primary">Create booking</Button>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2" padding="md">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">
                {format(currentMonth, "MMMM yyyy")}
              </h2>
              <div className="flex gap-1">
                <button
                  onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                  className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"
                >
                  <ChevronLeft size={20} />
                </button>
                <button
                  onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                  className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"
                >
                  <ChevronRight size={20} />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center">
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                <div key={d} className="py-2 text-xs font-semibold text-slate-500">
                  {d}
                </div>
              ))}
              {calendarDays.map((day) => {
                const dayBookings = bookingsByDay.get(day.toDateString()) ?? [];
                const isSelected = selectedDate && isSameDay(day, selectedDate);
                return (
                  <button
                    key={day.toISOString()}
                    onClick={() => setSelectedDate(day)}
                    className={`min-h-[80px] rounded-xl border p-2 text-left transition ${
                      isSameMonth(day, currentMonth)
                        ? "bg-white border-slate-100"
                        : "bg-slate-50/50 border-transparent text-slate-400"
                    } ${isSelected ? "ring-2 ring-emerald-500 border-emerald-500" : "hover:border-emerald-300"}`}
                  >
                    <div className="text-sm font-semibold text-slate-700">{format(day, "d")}</div>
                    {dayBookings.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {dayBookings.slice(0, 3).map((b) => (
                          <span
                            key={b.id}
                            className="h-2 w-2 rounded-full bg-emerald-500"
                            title={b.customer.user.name ?? "Booking"}
                          />
                        ))}
                        {dayBookings.length > 3 && (
                          <span className="text-[10px] text-slate-500">+{dayBookings.length - 3}</span>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </Card>

          <Card padding="md">
            <div className="mb-4 flex items-center gap-2">
              <CalendarDays size={20} className="text-emerald-600" />
              <h2 className="text-lg font-bold text-slate-900">
                {selectedDate ? format(selectedDate, "EEEE, d MMMM") : "Select a day"}
              </h2>
            </div>
            {selectedBookings.length === 0 ? (
              <p className="text-sm text-slate-500">
                {selectedDate ? "No bookings on this day." : "Click a date to see bookings."}
              </p>
            ) : (
              <ul className="space-y-3">
                {selectedBookings.map((b) => (
                  <li key={b.id} className="rounded-xl border border-slate-100 bg-slate-50/50 p-3">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-900">
                        {new Date(b.startsAt).toLocaleTimeString("en-GB", { timeZone: SCHOOL_TIMEZONE, hour: "2-digit", minute: "2-digit" })}
                      </span>
                      <Badge variant={b.status === "CONFIRMED" ? "success" : "neutral"}>{b.status}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-slate-600">
                      {b.customer.user.name ?? "Unknown"} with {b.instructor.user.name ?? "Unknown"}
                    </p>
                    <p className="text-xs text-slate-400 capitalize">{b.lessonType.toLowerCase()} • {b.source}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
