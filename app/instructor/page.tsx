"use client";

import { useEffect, useState } from "react";
import {
  Clock,
  Plus,
  Trash2,
  CalendarDays,
  MapPin,
  Car,
  PoundSterling,
  Settings,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription } from "@/app/components/ui/Card";
import { Badge } from "@/app/components/ui/Badge";
import { Button } from "@/app/components/ui/Button";
import { ProfileEditor } from "@/app/instructor/ProfileEditor";
import { BookingsTab } from "@/app/instructor/BookingsTab";
import { BlackoutsTab } from "@/app/instructor/BlackoutsTab";
import { cn } from "@/app/lib/cn";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

interface Instructor {
  id: string;
  user: { name: string | null; email: string | null };
  bio: string | null;
  phone: string | null;
  vehicleType: string | null;
  basePostcode: string;
  servicePostcodes: string[];
  transmission: string;
  hourlyRatePence: number;
  lessonDurationMinutes: number;
  travelBufferMinutes: number;
  maxLessonsPerDay: number;
  acceptsNewLearners: boolean;
  offersIntensive: boolean;
  active: boolean;
}

interface Availability {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

export default function InstructorPortal() {
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [availability, setAvailability] = useState<Availability[]>([]);
  const [form, setForm] = useState({ dayOfWeek: 1, startTime: "09:00", endTime: "17:00" });
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"availability" | "profile" | "bookings" | "timeoff">("availability");

  useEffect(() => {
    fetch("/api/instructors")
      .then((r) => r.json())
      .then((data) => {
        setInstructors(Array.isArray(data) ? data : data.items ?? []);
        if (data[0]) setSelected(data[0].id);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!selected) return;
    fetch(`/api/instructors/${selected}/availability`)
      .then((r) => r.json())
      .then(setAvailability);
  }, [selected]);

  async function addAvailability(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    const res = await fetch(`/api/instructors/${selected}/availability`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      const created = await res.json();
      setAvailability((prev) => [...prev, created]);
    }
  }

  async function removeAvailability(id: string) {
    if (!selected) return;
    await fetch(`/api/instructors/${selected}/availability?availabilityId=${id}`, {
      method: "DELETE",
    });
    setAvailability((prev) => prev.filter((a) => a.id !== id));
  }

  function updateInstructor(updated: Instructor) {
    setInstructors((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
  }

  const activeInstructor = instructors.find((i) => i.id === selected);

  if (loading) {
    return (
      <div className="px-6 py-12">
        <div className="mx-auto max-w-5xl">
          <div className="h-8 w-48 animate-pulse rounded-lg bg-slate-200" />
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-28 animate-pulse rounded-2xl bg-slate-200" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-6 py-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Instructor portal</h1>
            <p className="text-slate-500">Manage your profile, availability and time off.</p>
          </div>
          <select
            className="rounded-xl border-slate-200 bg-white p-2.5 text-sm font-medium text-slate-700 shadow-sm focus:border-emerald-500 focus:ring-emerald-500"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
          >
            {instructors.map((i) => (
              <option key={i.id} value={i.id}>
                {i.user.name ?? i.user.email ?? i.id}
              </option>
            ))}
          </select>
        </div>

        {activeInstructor && (
          <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="flex items-center gap-4" padding="md">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                <Car size={22} />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500">Vehicle</p>
                <p className="font-semibold text-slate-900">{activeInstructor.vehicleType ?? "Not set"}</p>
              </div>
            </Card>
            <Card className="flex items-center gap-4" padding="md">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <MapPin size={22} />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500">Base</p>
                <p className="font-semibold text-slate-900">{activeInstructor.basePostcode}</p>
              </div>
            </Card>
            <Card className="flex items-center gap-4" padding="md">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                <PoundSterling size={22} />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500">Rate</p>
                <p className="font-semibold text-slate-900">
                  £{(activeInstructor.hourlyRatePence / 100).toFixed(2)} / hr
                </p>
              </div>
            </Card>
            <Card className="flex items-center gap-4" padding="md">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
                <Clock size={22} />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500">Lesson</p>
                <p className="font-semibold text-slate-900">{activeInstructor.lessonDurationMinutes} min</p>
              </div>
            </Card>
          </div>
        )}

        <div className="mb-6 flex flex-wrap gap-2">
          <button
            onClick={() => setTab("bookings")}
            className={cn(
              "rounded-xl px-5 py-2.5 text-sm font-semibold transition-all",
              tab === "bookings" ? "bg-slate-900 text-white shadow-md dark:bg-slate-100 dark:text-slate-900" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700 dark:hover:bg-slate-700"
            )}
          >
            My bookings
          </button>
          <button
            onClick={() => setTab("availability")}
            className={cn(
              "rounded-xl px-5 py-2.5 text-sm font-semibold transition-all",
              tab === "availability" ? "bg-slate-900 text-white shadow-md dark:bg-slate-100 dark:text-slate-900" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700 dark:hover:bg-slate-700"
            )}
          >
            Availability
          </button>
          <button
            onClick={() => setTab("timeoff")}
            className={cn(
              "rounded-xl px-5 py-2.5 text-sm font-semibold transition-all",
              tab === "timeoff" ? "bg-slate-900 text-white shadow-md dark:bg-slate-100 dark:text-slate-900" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700 dark:hover:bg-slate-700"
            )}
          >
            Time off
          </button>
          <button
            onClick={() => setTab("profile")}
            className={cn(
              "rounded-xl px-5 py-2.5 text-sm font-semibold transition-all",
              tab === "profile" ? "bg-slate-900 text-white shadow-md dark:bg-slate-100 dark:text-slate-900" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700 dark:hover:bg-slate-700"
            )}
          >
            Profile
          </button>
        </div>

        {tab === "availability" && (
          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2" padding="none">
              <div className="border-b border-slate-200 px-6 py-4">
                <div className="flex items-center gap-2">
                  <div className="rounded-lg bg-emerald-50 p-2 text-emerald-600">
                    <CalendarDays size={20} />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Weekly availability</CardTitle>
                    <CardDescription>Set the days and hours you teach</CardDescription>
                  </div>
                </div>
              </div>

              <div className="px-6 py-4">
                {availability.length === 0 ? (
                  <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50/50 py-12 text-slate-500">
                    <Clock size={32} className="mb-3 opacity-40" />
                    <p className="font-medium">No availability set</p>
                    <p className="text-sm">Add your first weekly slot below.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {availability.map((a) => (
                      <div
                        key={a.id}
                        className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/50 p-4"
                      >
                        <div className="flex items-center gap-4">
                          <Badge variant="primary">{DAYS[a.dayOfWeek]}</Badge>
                          <span className="text-sm font-medium text-slate-700">
                            {a.startTime} - {a.endTime}
                          </span>
                        </div>
                        <button
                          onClick={() => removeAvailability(a.id)}
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
                <div className="flex items-center gap-2">
                  <Settings size={18} className="text-emerald-600" />
                  <CardTitle className="text-lg">Add slot</CardTitle>
                </div>
                <CardDescription>Add a repeating weekly time slot</CardDescription>
              </CardHeader>
              <form onSubmit={addAvailability} className="space-y-4">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">Day</label>
                  <select
                    className="w-full rounded-xl border-slate-200 bg-slate-50 p-2.5 text-sm focus:border-emerald-500 focus:ring-emerald-500"
                    value={form.dayOfWeek}
                    onChange={(e) => setForm({ ...form, dayOfWeek: Number(e.target.value) })}
                  >
                    {DAYS.map((d, i) => (
                      <option key={d} value={i}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-600">Start</label>
                    <input
                      type="time"
                      className="w-full rounded-xl border-slate-200 bg-slate-50 p-2.5 text-sm focus:border-emerald-500 focus:ring-emerald-500"
                      value={form.startTime}
                      onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-600">End</label>
                    <input
                      type="time"
                      className="w-full rounded-xl border-slate-200 bg-slate-50 p-2.5 text-sm focus:border-emerald-500 focus:ring-emerald-500"
                      value={form.endTime}
                      onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full" icon={<Plus size={16} />}>
                  Add weekly slot
                </Button>
              </form>
            </Card>
          </div>
        )}

        {tab === "bookings" && activeInstructor && (
          <BookingsTab instructorId={activeInstructor.id} />
        )}

        {tab === "timeoff" && activeInstructor && (
          <BlackoutsTab instructorId={activeInstructor.id} />
        )}

        {tab === "profile" && activeInstructor && (
          <ProfileEditor
            key={activeInstructor.id}
            instructor={activeInstructor}
            onUpdate={updateInstructor}
          />
        )}
      </div>
    </div>
  );
}
