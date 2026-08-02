"use client";

import { useEffect, useState } from "react";
import {
  CalendarDays,
  Users,
  Phone,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
} from "lucide-react";

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
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [calls, setCalls] = useState<CallLog[]>([]);
  const [tab, setTab] = useState<"bookings" | "instructors" | "calls">("bookings");

  useEffect(() => {
    fetch("/api/bookings").then((r) => r.json()).then(setBookings);
    fetch("/api/instructors").then((r) => r.json()).then(setInstructors);
    fetch("/api/calls").then((r) => r.json()).then(setCalls);
  }, []);

  const tabs = [
    { id: "bookings", label: "Bookings", icon: CalendarDays },
    { id: "instructors", label: "Instructors", icon: Users },
    { id: "calls", label: "Calls", icon: Phone },
  ] as const;

  return (
    <div className="px-6 py-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-zinc-900">Admin dashboard</h1>
          <p className="text-zinc-600">Overview of bookings, instructors and calls.</p>
        </div>

        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-zinc-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-zinc-500">Total bookings</p>
                <p className="mt-1 text-2xl font-bold text-zinc-900">{bookings.length}</p>
              </div>
              <div className="rounded-lg bg-indigo-50 p-2 text-indigo-600">
                <CalendarDays size={20} />
              </div>
            </div>
          </div>
          <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-zinc-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-zinc-500">Instructors</p>
                <p className="mt-1 text-2xl font-bold text-zinc-900">{instructors.length}</p>
              </div>
              <div className="rounded-lg bg-emerald-50 p-2 text-emerald-600">
                <Users size={20} />
              </div>
            </div>
          </div>
          <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-zinc-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-zinc-500">Recent calls</p>
                <p className="mt-1 text-2xl font-bold text-zinc-900">{calls.length}</p>
              </div>
              <div className="rounded-lg bg-amber-50 p-2 text-amber-600">
                <Phone size={20} />
              </div>
            </div>
          </div>
          <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-zinc-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-zinc-500">AI bookings</p>
                <p className="mt-1 text-2xl font-bold text-zinc-900">
                  {bookings.filter((b) => b.source === "PHONE_AI").length}
                </p>
              </div>
              <div className="rounded-lg bg-blue-50 p-2 text-blue-600">
                <TrendingUp size={20} />
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-xl bg-white shadow-sm ring-1 ring-zinc-200">
          <div className="border-b border-zinc-200 px-4 py-3">
            <div className="flex gap-2">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition ${
                    tab === t.id
                      ? "bg-zinc-900 text-white"
                      : "bg-white text-zinc-600 hover:bg-zinc-50"
                  }`}
                >
                  <t.icon size={16} />
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="p-4">
            {tab === "bookings" && (
              <div className="overflow-x-auto">
                {bookings.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-zinc-500">
                    <CalendarDays size={32} className="mb-2 opacity-40" />
                    <p>No bookings yet.</p>
                  </div>
                ) : (
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b text-xs font-medium text-zinc-500">
                        <th className="pb-3 pl-2">Customer</th>
                        <th className="pb-3">Instructor</th>
                        <th className="pb-3">Time</th>
                        <th className="pb-3">Status</th>
                        <th className="pb-3">Source</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bookings.map((b) => (
                        <tr key={b.id} className="border-b last:border-0 hover:bg-zinc-50">
                          <td className="py-3 pl-2 font-medium text-zinc-900">
                            {b.customer.user.name ?? b.customer.user.email ?? "Unknown"}
                          </td>
                          <td className="py-3 text-zinc-700">
                            {b.instructor.user.name ?? "Unknown"}
                          </td>
                          <td className="py-3 text-zinc-700">{formatTime(b.startsAt)}</td>
                          <td className="py-3">
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700">
                              <CheckCircle2 size={12} />
                              {b.status}
                            </span>
                          </td>
                          <td className="py-3 text-zinc-700">{b.source}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {tab === "instructors" && (
              <div className="overflow-x-auto">
                {instructors.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-zinc-500">
                    <Users size={32} className="mb-2 opacity-40" />
                    <p>No instructors yet.</p>
                  </div>
                ) : (
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b text-xs font-medium text-zinc-500">
                        <th className="pb-3 pl-2">Name</th>
                        <th className="pb-3">Base postcode</th>
                        <th className="pb-3">Rate</th>
                        <th className="pb-3">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {instructors.map((i) => (
                        <tr key={i.id} className="border-b last:border-0 hover:bg-zinc-50">
                          <td className="py-3 pl-2 font-medium text-zinc-900">
                            {i.user.name ?? i.user.email ?? i.id}
                          </td>
                          <td className="py-3 text-zinc-700">{i.basePostcode}</td>
                          <td className="py-3 text-zinc-700">
                            {formatCurrency(i.hourlyRatePence)} / hr
                          </td>
                          <td className="py-3">
                            {i.active ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700">
                                <CheckCircle2 size={12} /> Active
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-700">
                                <AlertCircle size={12} /> Inactive
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {tab === "calls" && (
              <div className="overflow-x-auto">
                {calls.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-zinc-500">
                    <Phone size={32} className="mb-2 opacity-40" />
                    <p>No calls yet.</p>
                  </div>
                ) : (
                  <ul className="divide-y divide-zinc-100">
                    {calls.map((c) => (
                      <li key={c.id} className="py-4">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-zinc-900">{c.fromNumber}</span>
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                              c.status === "HANDED_OFF"
                                ? "bg-amber-100 text-amber-700"
                                : c.status === "COMPLETED"
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-zinc-100 text-zinc-700"
                            }`}
                          >
                            {c.status}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-zinc-600">{c.summary}</p>
                        <p className="mt-1 text-xs text-zinc-400">
                          {new Date(c.startedAt).toLocaleString("en-GB")}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
