"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/app/components/ui/Card";
import { Button } from "@/app/components/ui/Button";
import { Badge } from "@/app/components/ui/Badge";
import { useToast } from "@/app/components/ToastProvider";
import { ArrowLeft, Plus, User, Mail, Phone, MapPin, Car, PoundSterling, Power, PowerOff, Loader2 } from "lucide-react";

interface Instructor {
  id: string;
  bio: string | null;
  vehicleType: string | null;
  transmission: string;
  basePostcode: string;
  servicePostcodes: string[];
  hourlyRatePence: number;
  lessonDurationMinutes: number;
  active: boolean;
  acceptsNewLearners: boolean;
  user: { id: string; name: string | null; email: string; phone: string | null };
}

export default function ManageInstructorsPage() {
  const { showToast } = useToast();
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/instructors")
      .then((r) => r.json())
      .then((data) => {
        setInstructors(Array.isArray(data) ? data : data.items ?? []);
        setLoading(false);
      });
  }, []);

  async function toggleActive(instructor: Instructor, field: "active" | "acceptsNewLearners") {
    setTogglingId(instructor.id);
    const res = await fetch(`/api/instructors/${instructor.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: !instructor[field] }),
    });
    if (res.ok) {
      setInstructors((prev) =>
        prev.map((i) => (i.id === instructor.id ? { ...i, [field]: !i[field] } : i))
      );
      showToast(`${field === "active" ? "Instructor" : "New learners"} ${instructor[field] ? "disabled" : "enabled"}`, "success");
    } else {
      showToast("Failed to update", "error");
    }
    setTogglingId(null);
  }

  if (loading) {
    return (
      <div className="px-6 py-12">
        <div className="mx-auto max-w-5xl">
          <div className="h-8 w-48 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-700" />
          <div className="mt-6 space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-700" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-6 py-8">
      <div className="mx-auto max-w-5xl">
        <Link href="/admin" className="mb-4 flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200">
          <ArrowLeft size={16} /> Back to dashboard
        </Link>
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Instructors</h1>
            <p className="text-slate-500 dark:text-slate-400">Manage instructor profiles and availability.</p>
          </div>
          <Button href="/admin/instructors/new" icon={<Plus size={16} />}>Add instructor</Button>
        </div>

        {instructors.length === 0 ? (
          <Card padding="lg" className="text-center">
            <User size={40} className="mx-auto text-slate-300" />
            <p className="mt-4 text-slate-500 dark:text-slate-400">No instructors yet.</p>
            <Button href="/admin/instructors/new" className="mt-6" variant="primary" icon={<Plus size={16} />}>
              Add the first instructor
            </Button>
          </Card>
        ) : (
          <div className="space-y-4">
            {instructors.map((instructor) => (
              <Card key={instructor.id} padding="md">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-xl font-bold text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">
                      {(instructor.user.name ?? "I")[0]}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900 dark:text-slate-100">{instructor.user.name ?? "Unknown"}</span>
                        {!instructor.active && <Badge variant="neutral">Inactive</Badge>}
                        {instructor.acceptsNewLearners && instructor.active && <Badge variant="success" dot>Available</Badge>}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500 dark:text-slate-400">
                        <span className="flex items-center gap-1"><Mail size={12} />{instructor.user.email}</span>
                        {instructor.user.phone && <span className="flex items-center gap-1"><Phone size={12} />{instructor.user.phone}</span>}
                        <span className="flex items-center gap-1"><MapPin size={12} />{instructor.basePostcode}</span>
                        <span className="flex items-center gap-1"><Car size={12} />{instructor.transmission.toLowerCase()}</span>
                        <span className="flex items-center gap-1"><PoundSterling size={12} />£{(instructor.hourlyRatePence / 100).toFixed(2)}/hr</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => toggleActive(instructor, "acceptsNewLearners")}
                      disabled={togglingId === instructor.id}
                      className={`flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-medium transition ${
                        instructor.acceptsNewLearners
                          ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-300"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400"
                      } disabled:opacity-50`}
                    >
                      {togglingId === instructor.id ? <Loader2 size={12} className="animate-spin" /> : instructor.acceptsNewLearners ? <Power size={12} /> : <PowerOff size={12} />}
                      {instructor.acceptsNewLearners ? "Accepting" : "Not accepting"}
                    </button>
                    <button
                      onClick={() => toggleActive(instructor, "active")}
                      disabled={togglingId === instructor.id}
                      className={`flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-medium transition ${
                        instructor.active
                          ? "bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-950 dark:text-red-300"
                          : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-300"
                      } disabled:opacity-50`}
                    >
                      {togglingId === instructor.id ? <Loader2 size={12} className="animate-spin" /> : instructor.active ? <PowerOff size={12} /> : <Power size={12} />}
                      {instructor.active ? "Deactivate" : "Activate"}
                    </button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
