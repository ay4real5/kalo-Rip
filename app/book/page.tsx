"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription } from "@/app/components/ui/Card";
import { Button } from "@/app/components/ui/Button";
import { Badge } from "@/app/components/ui/Badge";
import { useToast } from "@/app/components/ToastProvider";
import { MapPin, Calendar, Clock, Car, User, Mail, Phone, CheckCircle2, Loader2 } from "lucide-react";

interface Slot {
  instructorId: string;
  instructorName: string;
  startsAt: string;
  endsAt: string;
  pricePence: number;
  vehicleType?: string | null;
  postcode: string;
}

interface BookingResult {
  startsAt: string;
  pricePence: number;
  instructor?: { user?: { name?: string | null } };
}

export default function BookPage() {
  const { showToast } = useToast();
  const [step, setStep] = useState<"details" | "slots" | "confirm">("details");
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
  const [booking, setBooking] = useState<BookingResult | null>(null);

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
    setStep("slots");
    setLoading(false);
  }

  async function confirmBooking() {
    if (!selectedSlot) return;
    setLoading(true);
    const res = await fetch("/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        instructorId: selectedSlot.instructorId,
        startsAt: selectedSlot.startsAt,
        endsAt: selectedSlot.endsAt,
      }),
    });
    const data = await res.json();
    if (res.ok) {
      setBooking(data);
      setStep("confirm");
      showToast("Booking confirmed!", "success");
    } else {
      showToast(data.error || "Failed to create booking", "error");
    }
    setLoading(false);
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

  return (
    <div className="px-6 py-12">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Book a driving lesson</h1>
          <p className="mt-2 text-slate-600 dark:text-slate-400">Find a local instructor and book online in seconds.</p>
        </div>

        {step === "details" && (
          <Card padding="lg">
            <CardHeader className="px-0 pb-6">
              <CardTitle className="text-lg">Your details</CardTitle>
              <CardDescription>Tell us a little about yourself</CardDescription>
            </CardHeader>
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
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
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
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
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700">Postcode</label>
                  <div className="relative">
                    <MapPin size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      className="w-full rounded-xl border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm focus:border-emerald-500 focus:ring-emerald-500"
                      value={form.postcode}
                      onChange={(e) => setForm({ ...form, postcode: e.target.value })}
                      placeholder="SW1A 1AA"
                    />
                  </div>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
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
        )}

        {step === "slots" && (
          <Card padding="lg">
            <CardHeader className="px-0 pb-6">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Available slots</CardTitle>
                  <CardDescription>Choose a time that works for you</CardDescription>
                </div>
                <button onClick={() => setStep("details")} className="text-sm font-medium text-emerald-600 hover:text-emerald-700">
                  Back
                </button>
              </div>
            </CardHeader>

            {slots.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-slate-600">No slots available for your area.</p>
                <p className="text-sm text-slate-500 mt-1">Try a different postcode or call us.</p>
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
                          <Calendar size={18} />
                        </div>
                        <div>
                          <div className="font-semibold text-slate-900">{formatSlotTime(slot.startsAt)}</div>
                          <div className="flex items-center gap-2 text-sm text-slate-500">
                            <Clock size={14} />
                            {new Date(slot.startsAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })} -{" "}
                            {new Date(slot.endsAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-slate-900">{formatPrice(slot.pricePence)}</div>
                        <div className="flex items-center gap-1 text-xs text-slate-500">
                          <Car size={12} />
                          {slot.vehicleType ?? "Standard"}
                        </div>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <Badge variant="primary">{slot.instructorName}</Badge>
                      <Badge variant="neutral">{slot.postcode}</Badge>
                    </div>
                  </button>
                ))}
                <Button
                  onClick={confirmBooking}
                  disabled={!selectedSlot || loading}
                  className="w-full"
                  icon={loading ? <Loader2 size={18} className="animate-spin" /> : undefined}
                >
                  {loading ? "Booking..." : selectedSlot ? "Book selected slot" : "Select a slot"}
                </Button>
              </div>
            )}
          </Card>
        )}

        {step === "confirm" && booking && (
          <Card padding="lg" className="text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600">
              <CheckCircle2 size={32} />
            </div>
            <CardHeader className="px-0 pb-2 pt-4">
              <CardTitle className="text-xl">Booking confirmed</CardTitle>
              <CardDescription>Your lesson is booked. We will send a confirmation shortly.</CardDescription>
            </CardHeader>
            <div className="mt-4 rounded-xl bg-slate-50 p-4 text-left text-sm">
              <div className="flex justify-between py-2">
                <span className="text-slate-500">Instructor</span>
                <span className="font-medium text-slate-900">{booking.instructor?.user?.name ?? "Instructor"}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-slate-500">Time</span>
                <span className="font-medium text-slate-900">{formatSlotTime(String(booking.startsAt))}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-slate-500">Price</span>
                <span className="font-medium text-slate-900">{formatPrice(Number(booking.pricePence))}</span>
              </div>
            </div>
            <Button href="/" className="mt-6" variant="outline">
              Back to home
            </Button>
          </Card>
        )}
      </div>
    </div>
  );
}
