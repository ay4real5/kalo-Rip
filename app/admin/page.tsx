"use client";

import { useEffect, useState } from "react";

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
}

interface CallLog {
  id: string;
  fromNumber: string;
  status: string;
  startedAt: string;
  summary: string | null;
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

  return (
    <main className="min-h-screen bg-zinc-50 p-6">
      <div className="mx-auto max-w-5xl">
        <h1 className="text-2xl font-bold text-zinc-900">Admin dashboard</h1>
        <p className="text-zinc-600">Bookings, instructors, calls and overrides.</p>

        <div className="mt-6 flex gap-2">
          {(["bookings", "instructors", "calls"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-md px-4 py-2 text-sm font-semibold ${
                tab === t
                  ? "bg-zinc-900 text-white"
                  : "bg-white text-zinc-700 ring-1 ring-zinc-200"
              }`}
            >
              {t[0].toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {tab === "bookings" && (
          <div className="mt-6 rounded-xl bg-white p-6 shadow-sm ring-1 ring-zinc-200">
            <h2 className="text-lg font-semibold text-zinc-900">Bookings</h2>
            {bookings.length === 0 ? (
              <p className="mt-2 text-sm text-zinc-500">No bookings yet.</p>
            ) : (
              <table className="mt-4 w-full text-left text-sm">
                <thead>
                  <tr className="border-b text-zinc-500">
                    <th className="pb-2">Customer</th>
                    <th className="pb-2">Instructor</th>
                    <th className="pb-2">Time</th>
                    <th className="pb-2">Status</th>
                    <th className="pb-2">Source</th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.map((b) => (
                    <tr key={b.id} className="border-b last:border-0">
                      <td className="py-3">
                        {b.customer.user.name ?? b.customer.user.email ?? "Unknown"}
                      </td>
                      <td className="py-3">{b.instructor.user.name ?? "Unknown"}</td>
                      <td className="py-3">
                        {new Date(b.startsAt).toLocaleString("en-GB")}
                      </td>
                      <td className="py-3">
                        <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-800">
                          {b.status}
                        </span>
                      </td>
                      <td className="py-3">{b.source}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {tab === "instructors" && (
          <div className="mt-6 rounded-xl bg-white p-6 shadow-sm ring-1 ring-zinc-200">
            <h2 className="text-lg font-semibold text-zinc-900">Instructors</h2>
            {instructors.length === 0 ? (
              <p className="mt-2 text-sm text-zinc-500">No instructors yet.</p>
            ) : (
              <ul className="mt-4 divide-y divide-zinc-100">
                {instructors.map((i) => (
                  <li key={i.id} className="flex items-center justify-between py-3">
                    <span className="text-sm text-zinc-700">
                      {i.user.name ?? i.user.email ?? i.id}
                    </span>
                    <span className="text-xs text-zinc-500">
                      {i.active ? "Active" : "Inactive"} /{" "}
                      {i.acceptsNewLearners ? "Accepting learners" : "Not accepting"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {tab === "calls" && (
          <div className="mt-6 rounded-xl bg-white p-6 shadow-sm ring-1 ring-zinc-200">
            <h2 className="text-lg font-semibold text-zinc-900">Recent calls</h2>
            {calls.length === 0 ? (
              <p className="mt-2 text-sm text-zinc-500">No calls yet.</p>
            ) : (
              <ul className="mt-4 divide-y divide-zinc-100">
                {calls.map((c) => (
                  <li key={c.id} className="py-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-zinc-700">
                        {c.fromNumber}
                      </span>
                      <span className="text-xs text-zinc-500">
                        {c.status} · {new Date(c.startedAt).toLocaleString("en-GB")}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-zinc-600">{c.summary}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
