"use client";

import { useEffect, useState } from "react";
import { Clock, Plus, Trash2, CalendarDays, MapPin, Car } from "lucide-react";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

interface Instructor {
  id: string;
  user: { name: string | null; email: string | null };
  vehicleType: string | null;
  basePostcode: string;
  transmission: string;
  hourlyRatePence: number;
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
    await fetch(`/api/instructors/${selected}/availability?availabilityId=${id}`, {
      method: "DELETE",
    });
    setAvailability((prev) => prev.filter((a) => a.id !== id));
  }

  const activeInstructor = instructors.find((i) => i.id === selected);

  return (
    <div className="px-6 py-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-zinc-900">Instructor portal</h1>
          <p className="text-zinc-600">Manage your profile, availability and time off.</p>
        </div>

        <div className="mb-6 rounded-xl bg-white p-5 shadow-sm ring-1 ring-zinc-200">
          <label className="block text-sm font-semibold text-zinc-700">Instructor</label>
          <select
            className="mt-2 block w-full rounded-lg border-zinc-300 bg-zinc-50 p-2.5 text-sm focus:border-indigo-500 focus:ring-indigo-500"
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
          <div className="mb-6 grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-zinc-200">
              <div className="flex items-center gap-2 text-sm font-medium text-zinc-500">
                <Car size={16} />
                Vehicle
              </div>
              <p className="mt-1 text-zinc-900">{activeInstructor.vehicleType ?? "Not set"}</p>
            </div>
            <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-zinc-200">
              <div className="flex items-center gap-2 text-sm font-medium text-zinc-500">
                <MapPin size={16} />
                Base postcode
              </div>
              <p className="mt-1 text-zinc-900">{activeInstructor.basePostcode}</p>
            </div>
            <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-zinc-200">
              <div className="flex items-center gap-2 text-sm font-medium text-zinc-500">
                <Clock size={16} />
                Hourly rate
              </div>
              <p className="mt-1 text-zinc-900">
                £{(activeInstructor.hourlyRatePence / 100).toFixed(2)} / hr
              </p>
            </div>
          </div>
        )}

        <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-zinc-200">
          <div className="mb-4 flex items-center gap-2">
            <div className="rounded-lg bg-indigo-50 p-2 text-indigo-600">
              <CalendarDays size={20} />
            </div>
            <h2 className="text-lg font-semibold text-zinc-900">Weekly availability</h2>
          </div>

          {availability.length === 0 ? (
            <p className="text-sm text-zinc-500">No availability set yet.</p>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {availability.map((a) => (
                <li key={a.id} className="flex items-center justify-between py-4">
                  <div className="flex items-center gap-3">
                    <span className="rounded-lg bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-700">
                      {DAYS[a.dayOfWeek]}
                    </span>
                    <span className="text-sm text-zinc-700">
                      {a.startTime} - {a.endTime}
                    </span>
                  </div>
                  <button
                    onClick={() => removeAvailability(a.id)}
                    className="flex items-center gap-1 rounded-lg px-2 py-1 text-sm text-red-600 hover:bg-red-50"
                  >
                    <Trash2 size={14} />
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}

          <form onSubmit={addAvailability} className="mt-6 rounded-xl bg-zinc-50 p-4">
            <h3 className="mb-4 text-sm font-semibold text-zinc-900">Add weekly slot</h3>
            <div className="grid gap-4 sm:grid-cols-4">
              <select
                className="rounded-lg border-zinc-300 bg-white p-2.5 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                value={form.dayOfWeek}
                onChange={(e) => setForm({ ...form, dayOfWeek: Number(e.target.value) })}
              >
                {DAYS.map((d, i) => (
                  <option key={d} value={i}>
                    {d}
                  </option>
                ))}
              </select>
              <input
                type="time"
                className="rounded-lg border-zinc-300 bg-white p-2.5 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                value={form.startTime}
                onChange={(e) => setForm({ ...form, startTime: e.target.value })}
              />
              <input
                type="time"
                className="rounded-lg border-zinc-300 bg-white p-2.5 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                value={form.endTime}
                onChange={(e) => setForm({ ...form, endTime: e.target.value })}
              />
              <button
                type="submit"
                className="flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
              >
                <Plus size={16} />
                Add slot
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
