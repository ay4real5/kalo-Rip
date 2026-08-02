"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/app/components/ui/Card";
import { Button } from "@/app/components/ui/Button";
import { useToast } from "@/app/components/ToastProvider";
import { ArrowLeft, User, Mail, Phone, MapPin, Car, PoundSterling, Clock, Loader2, Plus } from "lucide-react";
import Link from "next/link";

export default function NewInstructorPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    basePostcode: "",
    servicePostcodes: "",
    transmission: "MANUAL" as "MANUAL" | "AUTOMATIC" | "BOTH",
    vehicleType: "",
    hourlyRatePence: 3000,
    lessonDurationMinutes: 60,
  });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/instructors/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        servicePostcodes: form.servicePostcodes
          ? form.servicePostcodes.split(",").map((s) => s.trim()).filter(Boolean)
          : [],
        hourlyRatePence: Number(form.hourlyRatePence),
        lessonDurationMinutes: Number(form.lessonDurationMinutes),
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      showToast("Instructor created", "success");
      router.push("/admin");
    } else {
      showToast(data.error || "Failed to create instructor", "error");
    }
    setSaving(false);
  }

  return (
    <div className="px-6 py-8">
      <div className="mx-auto max-w-2xl">
        <Link href="/admin" className="mb-4 flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200">
          <ArrowLeft size={16} /> Back to dashboard
        </Link>
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Add instructor</h1>
          <p className="text-slate-500 dark:text-slate-400">Create a new instructor profile.</p>
        </div>

        <Card padding="lg">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Full name" icon={<User size={16} />}>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Jane Smith"
                  className="input"
                />
              </Field>
              <Field label="Email" icon={<Mail size={16} />}>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="jane@example.com"
                  className="input"
                />
              </Field>
              <Field label="Phone" icon={<Phone size={16} />}>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="07123456789"
                  className="input"
                />
              </Field>
              <Field label="Base postcode" icon={<MapPin size={16} />}>
                <input
                  type="text"
                  required
                  value={form.basePostcode}
                  onChange={(e) => setForm({ ...form, basePostcode: e.target.value })}
                  placeholder="SW1A 1AA"
                  className="input"
                />
              </Field>
              <Field label="Service postcodes (comma separated)" icon={<MapPin size={16} />}>
                <input
                  type="text"
                  value={form.servicePostcodes}
                  onChange={(e) => setForm({ ...form, servicePostcodes: e.target.value })}
                  placeholder="SW1, SW2, SW3"
                  className="input"
                />
              </Field>
              <Field label="Vehicle type" icon={<Car size={16} />}>
                <input
                  type="text"
                  value={form.vehicleType}
                  onChange={(e) => setForm({ ...form, vehicleType: e.target.value })}
                  placeholder="Ford Fiesta"
                  className="input"
                />
              </Field>
              <Field label="Transmission" icon={<Car size={16} />}>
                <select
                  value={form.transmission}
                  onChange={(e) => setForm({ ...form, transmission: e.target.value as "MANUAL" | "AUTOMATIC" | "BOTH" })}
                  className="input"
                >
                  <option value="MANUAL">Manual</option>
                  <option value="AUTOMATIC">Automatic</option>
                  <option value="BOTH">Both</option>
                </select>
              </Field>
              <Field label="Hourly rate (£)" icon={<PoundSterling size={16} />}>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={form.hourlyRatePence / 100}
                  onChange={(e) => setForm({ ...form, hourlyRatePence: Math.round(Number(e.target.value) * 100) })}
                  className="input"
                />
              </Field>
              <Field label="Lesson duration (minutes)" icon={<Clock size={16} />}>
                <input
                  type="number"
                  min="30"
                  step="15"
                  value={form.lessonDurationMinutes}
                  onChange={(e) => setForm({ ...form, lessonDurationMinutes: Number(e.target.value) })}
                  className="input"
                />
              </Field>
            </div>

            <Button type="submit" className="w-full" disabled={saving} icon={saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}>
              {saving ? "Creating..." : "Create instructor"}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}

function Field({ label, icon, children }: { label: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400">
        {icon}
        {label}
      </label>
      {children}
      <style jsx>{`
        :global(.input) {
          width: 100%;
          border-radius: 0.75rem;
          border: 1px solid rgb(226 232 240);
          background: rgb(248 250 252);
          padding: 0.625rem 0.75rem;
          font-size: 0.875rem;
        }
        :global(.input:focus) {
          outline: none;
          border-color: rgb(16 185 129);
          box-shadow: 0 0 0 1px rgb(16 185 129);
        }
        :global(.dark .input) {
          border-color: rgb(71 85 105);
          background: rgb(30 41 59);
          color: rgb(241 245 249);
        }
      `}</style>
    </div>
  );
}
