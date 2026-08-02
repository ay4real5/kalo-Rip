"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription } from "@/app/components/ui/Card";
import { Button } from "@/app/components/ui/Button";
import { Badge } from "@/app/components/ui/Badge";
import { useToast } from "@/app/components/ToastProvider";
import { ArrowLeft, Calendar, Clock, User, Mail, Phone, MapPin, Car, CheckCircle2, Loader2 } from "lucide-react";
import Link from "next/link";

interface Slot {
  instructorId: string;
  instructorName: string;
  startsAt: string;
  endsAt: string;
  pricePence: number;
  vehicleType?: string | null;
}

export default function NewBookingPage() {
  const { showToast } = useToast();
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    postcode: "",
    transmission: "MANUAL" as "MANUAL" | "AUTOMATIC" | "BOTH",
    lessonType: "REGULAR" as "REGULAR" | "INTENSIVE" | "TEST" | "REFRESHER",
  });
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState(false);

  async function searchSlots() {
    setLoading(true);
    const res = await fetch("/api/bookings/available", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        postcode: form.postcode,
        transmission: form.transmission,
        lessonType: form.lessonType,
      }),
    });
    const data = await res.json();
    setSlots(data ?? []);
    setSelectedSlot(null);
    setLoading(false);
  }

  async function createBooking() {
    if (!selectedSlot) return;
    setCreating(true);
    const res = await fetch("/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        instructorId: selectedSlot.instructorId,
        startsAt: selectedSlot.startsAt,
        endsAt: selectedSlot.endsAt,
        source: "ADMIN",
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setCreated(true);
      showToast("Booking created successfully", "success");
    } else {
      showToast(data.error || "Failed to create booking", "error");
    }
    setCreating(false);
  }

  function formatSlotTime(iso: string) {
    return new Date(iso).toLocaleString("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function formatPrice(pence: number) {
    return `£${(pence / 100).toFixed(2)}`;
  }

  if (created) {
    return (
      <div className="px-6 py-8">
        <div className="mx-auto max-w-2xl text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600">
            <CheckCircle2 size={40} />
          </div>
          <h1 className="mt-6 text-2xl font-bold text-slate-900">Booking created</h1>
          <p className="mt-2 text-slate-600">The lesson has been added to the system.</p>
          <div className="mt-8 flex justify-center gap-3">
            <Button href="/admin" variant="primary">Back to dashboard</Button>
            <Button href="/admin/bookings/new" variant="outline">Create another</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-6 py-8">
      <div className="mx-auto max-w-4xl">
        <Link href="/admin" className="mb-4 flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-slate-900">
          <ArrowLeft size={16} /> Back to dashboard
        </Link>
        <h1 className="text-2xl font-bold text-slate-900">Create booking</h1>
        <p className="text-slate-500">Manually book a lesson for a learner.</p>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <Card padding="lg">
            <CardHeader className="px-0 pb-6">
              <CardTitle className="text-lg">Customer details</CardTitle>
              <CardDescription>Enter the learner&apos;s information</CardDescription>
            </CardHeader>
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">Full name</label>
                <div className="relative">
                  <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    className="w-full rounded-xl border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm focus:border-emerald-500 focus:ring-emerald-500"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Jane Smith"
                  />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700">Email</label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="email"
                      className="w-full rounded-xl border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm focus:border-emerald-500 focus:ring-emerald-500"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      placeholder="jane@example.com"
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700">Phone</label>
                  <div className="relative">
                    <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      className="w-full rounded-xl border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm focus:border-emerald-500 focus:ring-emerald-500"
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      placeholder="+44 7123 456789"
                    />
                  </div>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700">Postcode</label>
                  <div className="relative">
                    <MapPin size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      className="w-full rounded-xl border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm focus:border-emerald-500 focus:ring-emerald-500"
                      value={form.postcode}
                      onChange={(e) => setForm({ ...form, postcode: e.target.value })}
                      placeholder="CR0 1AA"
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700">Lesson type</label>
                  <select
                    className="w-full rounded-xl border-slate-200 bg-slate-50 py-2.5 pl-3 pr-4 text-sm focus:border-emerald-500 focus:ring-emerald-500"
                    value={form.lessonType}
                    onChange={(e) => setForm({ ...form, lessonType: e.target.value as typeof form.lessonType })}
                  >
                    <option value="REGULAR">Regular lesson</option>
                    <option value="TEST">Test preparation</option>
                    <option value="INTENSIVE">Intensive course</option>
                    <option value="REFRESHER">Refresher</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">Transmission</label>
                <select
                  className="w-full rounded-xl border-slate-200 bg-slate-50 py-2.5 pl-3 pr-4 text-sm focus:border-emerald-500 focus:ring-emerald-500"
                  value={form.transmission}
                  onChange={(e) => setForm({ ...form, transmission: e.target.value as typeof form.transmission })}
                >
                  <option value="MANUAL">Manual</option>
                  <option value="AUTOMATIC">Automatic</option>
                  <option value="BOTH">No preference</option>
                </select>
              </div>
              <Button
                onClick={searchSlots}
                disabled={loading || !form.name || !form.email || !form.phone || !form.postcode}
                className="w-full"
                icon={loading ? <Loader2 size={18} className="animate-spin" /> : undefined}
              >
                {loading ? "Searching..." : "Find available slots"}
              </Button>
            </div>
          </Card>

          <Card padding="lg">
            <CardHeader className="px-0 pb-6">
              <CardTitle className="text-lg">Available slots</CardTitle>
              <CardDescription>Select a time and instructor</CardDescription>
            </CardHeader>
            {slots.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50/50 py-12 text-slate-500">
                <Calendar size={32} className="mb-2 opacity-40" />
                <p className="font-medium">No slots yet</p>
                <p className="text-sm">Enter customer details and search.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {slots.map((slot) => (
                  <button
                    key={`${slot.instructorId}-${slot.startsAt}`}
                    onClick={() => setSelectedSlot(slot)}
                    className={`w-full rounded-xl border p-4 text-left transition ${
                      selectedSlot?.startsAt === slot.startsAt && selectedSlot?.instructorId === slot.instructorId
                        ? "border-emerald-500 bg-emerald-50/50 ring-1 ring-emerald-500"
                        : "border-slate-200 bg-white hover:border-emerald-300"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
                          <Clock size={18} />
                        </div>
                        <div>
                          <div className="font-semibold text-slate-900">{formatSlotTime(slot.startsAt)}</div>
                          <div className="text-sm text-slate-500">
                            {new Date(slot.startsAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })} -{" "}
                            {new Date(slot.endsAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-slate-900">{formatPrice(slot.pricePence)}</div>
                        <div className="text-xs text-slate-500">{slot.vehicleType ?? "Standard"}</div>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <Badge variant="primary">{slot.instructorName}</Badge>
                      <Badge variant="neutral"><Car size={12} className="mr-1" /> {slot.vehicleType ?? "Standard"}</Badge>
                    </div>
                  </button>
                ))}
              </div>
            )}
            {selectedSlot && (
              <Button
                onClick={createBooking}
                disabled={creating}
                className="mt-4 w-full"
                icon={creating ? <Loader2 size={18} className="animate-spin" /> : undefined}
              >
                {creating ? "Creating..." : "Create booking"}
              </Button>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
