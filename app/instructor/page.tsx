"use client";

import { useEffect, useState } from "react";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface Instructor {
  id: string;
  user: { name: string | null; email: string | null };
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
  const [form, setForm] = useState({
    dayOfWeek: 1,
    startTime: "09:00",
    endTime: "17:00",
  });

  useEffect(() => {
    fetch("/api/instructors")
      .then((r) => r.json())
      .then((data) => {
        setInstructors(data);
        if (data[0]) setSelected(data[0].id);
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
    await fetch(
      `/api/instructors/${selected}/availability?availabilityId=${id}`,
      { method: "DELETE" }
    );
    setAvailability((prev) => prev.filter((a) => a.id !== id));
  }

  return (
    <main className="min-h-screen bg-zinc-50 p-6">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-bold text-zinc-900">Instructor portal</h1>
        <p className="text-zinc-600">Manage your weekly availability and time off.</p>

        <div className="mt-6 rounded-xl bg-white p-6 shadow-sm ring-1 ring-zinc-200">
          <label className="block text-sm font-medium text-zinc-700">
            Instructor
          </label>
          <select
            className="mt-1 block w-full rounded-md border-zinc-300 p-2 text-sm"
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

        <div className="mt-6 rounded-xl bg-white p-6 shadow-sm ring-1 ring-zinc-200">
          <h2 className="text-lg font-semibold text-zinc-900">Weekly availability</h2>
          {availability.length === 0 && (
            <p className="mt-2 text-sm text-zinc-500">No availability set yet.</p>
          )}
          <ul className="mt-4 divide-y divide-zinc-100">
            {availability.map((a) => (
              <li key={a.id} className="flex items-center justify-between py-3">
                <span className="text-sm text-zinc-700">
                  {DAYS[a.dayOfWeek]} {a.startTime} - {a.endTime}
                </span>
                <button
                  onClick={() => removeAvailability(a.id)}
                  className="text-sm text-red-600 hover:text-red-800"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>

          <form onSubmit={addAvailability} className="mt-6 grid gap-4 sm:grid-cols-4">
            <select
              className="rounded-md border-zinc-300 p-2 text-sm"
              value={form.dayOfWeek}
              onChange={(e) =>
                setForm({ ...form, dayOfWeek: Number(e.target.value) })
              }
            >
              {DAYS.map((d, i) => (
                <option key={d} value={i}>
                  {d}
                </option>
              ))}
            </select>
            <input
              type="time"
              className="rounded-md border-zinc-300 p-2 text-sm"
              value={form.startTime}
              onChange={(e) => setForm({ ...form, startTime: e.target.value })}
            />
            <input
              type="time"
              className="rounded-md border-zinc-300 p-2 text-sm"
              value={form.endTime}
              onChange={(e) => setForm({ ...form, endTime: e.target.value })}
            />
            <button
              type="submit"
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
            >
              Add slot
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
