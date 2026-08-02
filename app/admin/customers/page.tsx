"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/app/components/ui/Card";
import { Button } from "@/app/components/ui/Button";
import { Badge } from "@/app/components/ui/Badge";
import { ArrowLeft, Users, Phone, MapPin, CalendarDays, Car } from "lucide-react";

interface Customer {
  id: string;
  postcode: string;
  transmission: string;
  user: { name: string | null; email: string; phone: string | null };
  bookings: { id: string; startsAt: string; status: string; lessonType: string }[];
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/customers")
      .then((r) => r.json())
      .then((data) => {
        setCustomers(data);
        setLoading(false);
      });
  }, []);

  const filtered = customers.filter(
    (c) =>
      (c.user.name ?? "").toLowerCase().includes(search.toLowerCase()) ||
      c.user.email.toLowerCase().includes(search.toLowerCase()) ||
      c.postcode.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="px-6 py-12">
        <div className="mx-auto max-w-6xl">
          <div className="h-8 w-48 animate-pulse rounded-lg bg-slate-200" />
          <div className="mt-6 h-64 animate-pulse rounded-2xl bg-slate-200" />
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
            <h1 className="text-2xl font-bold text-slate-900">Customers</h1>
            <p className="text-slate-500">Manage learners and their booking history.</p>
          </div>
          <Button href="/admin/bookings/new" variant="primary">Create booking</Button>
        </div>

        <Card padding="md" className="mb-6">
          <div className="relative">
            <Users size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name, email or postcode..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm focus:border-emerald-500 focus:ring-emerald-500"
            />
          </div>
        </Card>

        <Card padding="none" className="overflow-hidden">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-16 text-slate-500">
              <Users size={32} className="mb-2 opacity-40" />
              <p>No customers found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50 text-xs font-medium text-slate-500">
                    <th className="px-6 py-3">Customer</th>
                    <th className="px-6 py-3">Contact</th>
                    <th className="px-6 py-3">Area</th>
                    <th className="px-6 py-3">Bookings</th>
                    <th className="px-6 py-3">Transmission</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c) => (
                    <tr key={c.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 font-semibold">
                            {(c.user.name ?? "U")[0]}
                          </div>
                          <div>
                            <div className="font-medium text-slate-900">{c.user.name ?? "Unknown"}</div>
                            <div className="text-xs text-slate-500">{c.user.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {c.user.phone ? (
                          <div className="flex items-center gap-1 text-slate-700">
                            <Phone size={14} />
                            {c.user.phone}
                          </div>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1 text-slate-700">
                          <MapPin size={14} />
                          {c.postcode}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <CalendarDays size={14} className="text-slate-400" />
                          <span className="font-medium text-slate-900">{c.bookings.length}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant="neutral">
                          <Car size={12} className="mr-1" />
                          {c.transmission}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
