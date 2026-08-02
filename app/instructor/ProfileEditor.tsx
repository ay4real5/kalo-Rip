"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription } from "@/app/components/ui/Card";
import { Button } from "@/app/components/ui/Button";
import { useToast } from "@/app/components/ToastProvider";
import { User, Save, Loader2, CheckCircle2 } from "lucide-react";

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
  autoConfirm: boolean;
  active: boolean;
}

interface ProfileEditorProps {
  instructor: Instructor;
  onUpdate: (updated: Instructor) => void;
}

export function ProfileEditor({ instructor, onUpdate }: ProfileEditorProps) {
  const { showToast } = useToast();
  const [profile, setProfile] = useState({ ...instructor });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch(`/api/instructors/${instructor.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bio: profile.bio,
        phone: profile.phone,
        vehicleType: profile.vehicleType,
        transmission: profile.transmission,
        basePostcode: profile.basePostcode,
        servicePostcodes: profile.servicePostcodes,
        lessonDurationMinutes: profile.lessonDurationMinutes,
        travelBufferMinutes: profile.travelBufferMinutes,
        maxLessonsPerDay: profile.maxLessonsPerDay,
        hourlyRatePence: profile.hourlyRatePence,
        acceptsNewLearners: profile.acceptsNewLearners,
        offersIntensive: profile.offersIntensive,
        autoConfirm: profile.autoConfirm,
      }),
    });
    if (res.ok) {
      const updated = await res.json();
      onUpdate({ ...instructor, ...updated });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      showToast("Profile saved", "success");
    } else {
      showToast("Failed to save profile", "error");
    }
    setSaving(false);
  }

  return (
    <Card padding="lg">
      <CardHeader className="px-0 pb-6">
        <div className="flex items-center gap-2">
          <User size={20} className="text-emerald-600" />
          <CardTitle className="text-lg">Profile settings</CardTitle>
        </div>
        <CardDescription>Update your teaching details and service area</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit} className="grid gap-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-sm font-semibold text-slate-700">Bio</label>
          <textarea
            className="w-full rounded-xl border-slate-200 bg-slate-50 p-3 text-sm focus:border-emerald-500 focus:ring-emerald-500"
            rows={3}
            value={profile.bio ?? ""}
            onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
            placeholder="Short bio shown to learners..."
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-slate-700">Phone</label>
          <input
            className="w-full rounded-xl border-slate-200 bg-slate-50 p-2.5 text-sm focus:border-emerald-500 focus:ring-emerald-500"
            value={profile.phone ?? ""}
            onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
            placeholder="+44 7123 456789"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-slate-700">Vehicle type</label>
          <input
            className="w-full rounded-xl border-slate-200 bg-slate-50 p-2.5 text-sm focus:border-emerald-500 focus:ring-emerald-500"
            value={profile.vehicleType ?? ""}
            onChange={(e) => setProfile({ ...profile, vehicleType: e.target.value })}
            placeholder="Ford Fiesta"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-slate-700">Transmission</label>
          <select
            className="w-full rounded-xl border-slate-200 bg-slate-50 p-2.5 text-sm focus:border-emerald-500 focus:ring-emerald-500"
            value={profile.transmission}
            onChange={(e) => setProfile({ ...profile, transmission: e.target.value })}
          >
            <option value="MANUAL">Manual</option>
            <option value="AUTOMATIC">Automatic</option>
            <option value="BOTH">Both</option>
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-slate-700">Base postcode</label>
          <input
            className="w-full rounded-xl border-slate-200 bg-slate-50 p-2.5 text-sm focus:border-emerald-500 focus:ring-emerald-500"
            value={profile.basePostcode}
            onChange={(e) => setProfile({ ...profile, basePostcode: e.target.value.toUpperCase() })}
            placeholder="CR0 1AA"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-slate-700">Service postcodes (comma separated)</label>
          <input
            className="w-full rounded-xl border-slate-200 bg-slate-50 p-2.5 text-sm focus:border-emerald-500 focus:ring-emerald-500"
            value={profile.servicePostcodes.join(", ")}
            onChange={(e) =>
              setProfile({
                ...profile,
                servicePostcodes: e.target.value.split(",").map((p) => p.trim().toUpperCase()),
              })
            }
            placeholder="CR0, CR1, CR2"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-slate-700">Lesson duration (minutes)</label>
          <input
            type="number"
            className="w-full rounded-xl border-slate-200 bg-slate-50 p-2.5 text-sm focus:border-emerald-500 focus:ring-emerald-500"
            value={profile.lessonDurationMinutes}
            onChange={(e) => setProfile({ ...profile, lessonDurationMinutes: Number(e.target.value) })}
            min={30}
            step={15}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-slate-700">Hourly rate (£)</label>
          <input
            type="number"
            step="0.01"
            className="w-full rounded-xl border-slate-200 bg-slate-50 p-2.5 text-sm focus:border-emerald-500 focus:ring-emerald-500"
            value={(profile.hourlyRatePence / 100).toFixed(2)}
            onChange={(e) => setProfile({ ...profile, hourlyRatePence: Math.round(Number(e.target.value) * 100) })}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-slate-700">Max lessons per day</label>
          <input
            type="number"
            className="w-full rounded-xl border-slate-200 bg-slate-50 p-2.5 text-sm focus:border-emerald-500 focus:ring-emerald-500"
            value={profile.maxLessonsPerDay}
            onChange={(e) => setProfile({ ...profile, maxLessonsPerDay: Number(e.target.value) })}
            min={1}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-slate-700">Travel buffer (minutes)</label>
          <input
            type="number"
            className="w-full rounded-xl border-slate-200 bg-slate-50 p-2.5 text-sm focus:border-emerald-500 focus:ring-emerald-500"
            value={profile.travelBufferMinutes}
            onChange={(e) => setProfile({ ...profile, travelBufferMinutes: Number(e.target.value) })}
            min={0}
          />
        </div>
        <div className="flex flex-wrap items-center gap-4 sm:col-span-2">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              checked={profile.acceptsNewLearners}
              onChange={(e) => setProfile({ ...profile, acceptsNewLearners: e.target.checked })}
              className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
            />
            Accepts new learners
          </label>
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              checked={profile.offersIntensive}
              onChange={(e) => setProfile({ ...profile, offersIntensive: e.target.checked })}
              className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
            />
            Offers intensive courses
          </label>
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              checked={profile.autoConfirm}
              onChange={(e) => setProfile({ ...profile, autoConfirm: e.target.checked })}
              className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
            />
            Auto-confirm bookings
          </label>
        </div>
        <div className="sm:col-span-2">
          <Button
            type="submit"
            disabled={saving}
            icon={
              saving ? (
                <Loader2 size={18} className="animate-spin" />
              ) : saved ? (
                <CheckCircle2 size={18} />
              ) : (
                <Save size={18} />
              )
            }
          >
            {saving ? "Saving..." : saved ? "Saved" : "Save profile"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
