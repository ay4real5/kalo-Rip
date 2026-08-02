"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/app/components/ui/Card";
import { Button } from "@/app/components/ui/Button";
import { Badge } from "@/app/components/ui/Badge";
import { useToast } from "@/app/components/ToastProvider";
import { ArrowLeft, Package, Plus, Trash2, Loader2, PoundSterling } from "lucide-react";

interface LessonPackage {
  id: string;
  name: string;
  description: string | null;
  type: string;
  lessonCount: number;
  pricePence: number;
  active: boolean;
}

export default function PackagesPage() {
  const { showToast } = useToast();
  const [packages, setPackages] = useState<LessonPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    type: "SINGLE" as "SINGLE" | "BLOCK_5" | "BLOCK_10" | "INTENSIVE",
    lessonCount: 1,
    pricePence: 3000,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/packages")
      .then((r) => r.json())
      .then((data) => {
        setPackages(data);
        setLoading(false);
      });
  }, []);

  async function createPackage(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/packages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        pricePence: Number(form.pricePence),
        lessonCount: Number(form.lessonCount),
      }),
    });
    if (res.ok) {
      const created = await res.json();
      setPackages((prev) => [...prev, created].sort((a, b) => a.pricePence - b.pricePence));
      setForm({ name: "", description: "", type: "SINGLE", lessonCount: 1, pricePence: 3000 });
      setShowForm(false);
      showToast("Package created", "success");
    } else {
      showToast("Failed to create package", "error");
    }
    setSaving(false);
  }

  async function deletePackage(id: string) {
    if (!confirm("Delete this package?")) return;
    const res = await fetch(`/api/packages/${id}`, { method: "DELETE" });
    if (res.ok) {
      setPackages((prev) => prev.filter((p) => p.id !== id));
      showToast("Package deleted", "success");
    }
  }

  if (loading) {
    return (
      <div className="px-6 py-12">
        <div className="mx-auto max-w-4xl">
          <div className="h-8 w-48 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-700" />
          <div className="mt-6 h-64 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-700" />
        </div>
      </div>
    );
  }

  return (
    <div className="px-6 py-8">
      <div className="mx-auto max-w-4xl">
        <Link href="/admin" className="mb-4 flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200">
          <ArrowLeft size={16} /> Back to dashboard
        </Link>
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Lesson packages</h1>
            <p className="text-slate-500 dark:text-slate-400">Create block booking discounts and packages.</p>
          </div>
          <Button onClick={() => setShowForm(!showForm)} icon={<Plus size={16} />}>
            {showForm ? "Cancel" : "Add package"}
          </Button>
        </div>

        {showForm && (
          <Card padding="lg" className="mb-6">
            <form onSubmit={createPackage} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">Name</label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="5 Lesson Block"
                    className="w-full rounded-xl border-slate-200 bg-slate-50 p-2.5 text-sm focus:border-emerald-500 focus:ring-emerald-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">Type</label>
                  <select
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value as "SINGLE" | "BLOCK_5" | "BLOCK_10" | "INTENSIVE" })}
                    className="w-full rounded-xl border-slate-200 bg-slate-50 p-2.5 text-sm focus:border-emerald-500 focus:ring-emerald-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                  >
                    <option value="SINGLE">Single lesson</option>
                    <option value="BLOCK_5">Block of 5</option>
                    <option value="BLOCK_10">Block of 10</option>
                    <option value="INTENSIVE">Intensive course</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">Lesson count</label>
                  <input
                    type="number"
                    min="1"
                    value={form.lessonCount}
                    onChange={(e) => setForm({ ...form, lessonCount: Number(e.target.value) })}
                    className="w-full rounded-xl border-slate-200 bg-slate-50 p-2.5 text-sm focus:border-emerald-500 focus:ring-emerald-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">Total price (£)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={form.pricePence / 100}
                    onChange={(e) => setForm({ ...form, pricePence: Math.round(Number(e.target.value) * 100) })}
                    className="w-full rounded-xl border-slate-200 bg-slate-50 p-2.5 text-sm focus:border-emerald-500 focus:ring-emerald-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">Description (optional)</label>
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Save 10% when you book 5 lessons"
                  className="w-full rounded-xl border-slate-200 bg-slate-50 p-2.5 text-sm focus:border-emerald-500 focus:ring-emerald-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>
              <Button type="submit" disabled={saving} icon={saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}>
                {saving ? "Creating..." : "Create package"}
              </Button>
            </form>
          </Card>
        )}

        {packages.length === 0 ? (
          <Card padding="lg" className="text-center">
            <Package size={40} className="mx-auto text-slate-300" />
            <p className="mt-4 text-slate-500 dark:text-slate-400">No packages yet. Create one to offer block discounts.</p>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {packages.map((pkg) => (
              <Card key={pkg.id} padding="md">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-slate-900 dark:text-slate-100">{pkg.name}</h3>
                      <Badge variant="primary">{pkg.type.replace("_", " ").toLowerCase()}</Badge>
                    </div>
                    {pkg.description && (
                      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{pkg.description}</p>
                    )}
                    <div className="mt-3 flex items-center gap-4 text-sm">
                      <span className="flex items-center gap-1 font-semibold text-emerald-600">
                        <PoundSterling size={14} />
                        {(pkg.pricePence / 100).toFixed(2)}
                      </span>
                      <span className="text-slate-500 dark:text-slate-400">
                        {pkg.lessonCount} lesson{pkg.lessonCount !== 1 ? "s" : ""}
                      </span>
                      {pkg.lessonCount > 1 && (
                        <span className="text-xs text-slate-400">
                          £{(pkg.pricePence / pkg.lessonCount / 100).toFixed(2)}/lesson
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => deletePackage(pkg.id)}
                    className="rounded-lg p-2 text-red-600 transition hover:bg-red-50 dark:hover:bg-red-950"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
