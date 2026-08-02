"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Card } from "@/app/components/ui/Card";
import { Button } from "@/app/components/ui/Button";
import { Badge } from "@/app/components/ui/Badge";
import { ArrowLeft, TrendingUp, CalendarDays, PoundSterling, Bot, Car, Phone } from "lucide-react";

interface Booking {
  id: string;
  startsAt: string;
  status: string;
  source: string;
  lessonType: string;
  pricePence: number;
  createdAt: string;
  customer: { user: { name: string | null } };
}

interface Instructor {
  id: string;
  user: { name: string | null };
  bookings: { id: string }[];
}

interface CallLog {
  id: string;
  status: string;
}

export default function AnalyticsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [calls, setCalls] = useState<CallLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/analytics")
      .then((r) => r.json())
      .then((data) => {
        setBookings(data.bookings ?? []);
        setInstructors(data.instructors ?? []);
        setCalls(data.calls ?? []);
        setLoading(false);
      });
  }, []);

  const stats = useMemo(() => {
    const confirmed = bookings.filter((b) => b.status === "CONFIRMED");
    const totalRevenue = confirmed.reduce((sum, b) => sum + b.pricePence, 0);
    const aiBookings = confirmed.filter((b) => b.source === "PHONE_AI").length;
    const thisMonth = confirmed.filter((b) => new Date(b.startsAt).getMonth() === new Date().getMonth());
    const monthlyRevenue = thisMonth.reduce((sum, b) => sum + b.pricePence, 0);

    return {
      totalBookings: confirmed.length,
      totalRevenue,
      monthlyRevenue,
      aiBookings,
      cancellationRate: bookings.length > 0 ? (bookings.filter((b) => b.status === "CANCELLED").length / bookings.length) * 100 : 0,
      calls: calls.length,
      handoffs: calls.filter((c) => c.status === "HANDED_OFF").length,
    };
  }, [bookings, calls]);

  const bySource = useMemo(() => {
    const map = new Map<string, number>();
    for (const b of bookings.filter((b) => b.status === "CONFIRMED")) {
      map.set(b.source, (map.get(b.source) ?? 0) + 1);
    }
    return Array.from(map.entries());
  }, [bookings]);

  const byInstructor = useMemo(() => {
    return instructors
      .map((i) => ({
        name: i.user.name ?? "Unknown",
        count: i.bookings?.length ?? 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [instructors]);

  if (loading) {
    return (
      <div className="px-6 py-12">
        <div className="mx-auto max-w-6xl">
          <div className="h-8 w-48 animate-pulse rounded-lg bg-slate-200" />
          <div className="mt-6 grid gap-4 sm:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-32 animate-pulse rounded-2xl bg-slate-200" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-6 py-8">
      <div className="mx-auto max-w-6xl">
        <Link href="/admin" className="mb-4 flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-slate-900">
          <ArrowLeft size={16} /> Back to dashboard
        </Link>
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Analytics</h1>
            <p className="text-slate-500">Key metrics for your driving school.</p>
          </div>
          <Button href="/admin/bookings/new" variant="primary">Create booking</Button>
        </div>

        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            icon={CalendarDays}
            label="Confirmed bookings"
            value={stats.totalBookings}
            color="bg-emerald-50 text-emerald-600"
          />
          <StatCard
            icon={PoundSterling}
            label="Total revenue"
            value={`£${(stats.totalRevenue / 100).toFixed(2)}`}
            color="bg-amber-50 text-amber-600"
            sub={`£${(stats.monthlyRevenue / 100).toFixed(2)} this month`}
          />
          <StatCard
            icon={Bot}
            label="AI bookings"
            value={stats.aiBookings}
            color="bg-violet-50 text-violet-600"
          />
          <StatCard
            icon={Phone}
            label="Calls / handoffs"
            value={`${stats.calls} / ${stats.handoffs}`}
            color="bg-blue-50 text-blue-600"
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card padding="md">
            <div className="mb-4 flex items-center gap-2">
              <TrendingUp size={20} className="text-emerald-600" />
              <h2 className="text-lg font-bold text-slate-900">Bookings by source</h2>
            </div>
            {bySource.length === 0 ? (
              <p className="text-sm text-slate-500">No data yet.</p>
            ) : (
              <div className="space-y-3">
                {bySource.map(([source, count]) => (
                  <div key={source} className="flex items-center justify-between">
                    <Badge variant={source === "PHONE_AI" ? "primary" : "neutral"}>{source}</Badge>
                    <div className="flex items-center gap-2">
                      <div className="h-2 rounded-full bg-emerald-500" style={{ width: `${Math.max(count * 10, 40)}px` }} />
                      <span className="text-sm font-semibold text-slate-700">{count}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card padding="md">
            <div className="mb-4 flex items-center gap-2">
              <Car size={20} className="text-emerald-600" />
              <h2 className="text-lg font-bold text-slate-900">Top instructors</h2>
            </div>
            {byInstructor.length === 0 ? (
              <p className="text-sm text-slate-500">No data yet.</p>
            ) : (
              <div className="space-y-3">
                {byInstructor.map((i) => (
                  <div key={i.name} className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-700">{i.name}</span>
                    <div className="flex items-center gap-2">
                      <div className="h-2 rounded-full bg-emerald-500" style={{ width: `${Math.max(i.count * 10, 40)}px` }} />
                      <span className="text-sm font-semibold text-slate-700">{i.count}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
  sub,
}: {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
  color: string;
  sub?: string;
}) {
  return (
    <Card padding="md">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
          {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
        </div>
        <div className={`rounded-xl p-2.5 ${color}`}>
          <Icon size={20} />
        </div>
      </div>
    </Card>
  );
}
