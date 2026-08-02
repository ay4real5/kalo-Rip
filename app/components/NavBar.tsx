"use client";

import Link from "next/link";
import { Phone, LayoutDashboard, CalendarDays, Menu, X } from "lucide-react";
import { Button } from "@/app/components/ui/Button";
import { useState } from "react";

export function NavBar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  const links = [
    { href: "/admin", icon: LayoutDashboard, label: "Admin" },
    { href: "/instructor", icon: CalendarDays, label: "Instructor" },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-2.5 text-slate-900">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-lg shadow-emerald-600/20">
            <Phone size={18} strokeWidth={2.5} />
          </div>
          <span className="text-xl font-bold tracking-tight">Kalo Rip</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
            >
              <link.icon size={16} />
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden md:block">
          <Button href="/admin" size="sm" variant="primary">
            Open dashboard
          </Button>
        </div>

        <button
          className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 md:hidden"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          {mobileOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {mobileOpen && (
        <div className="border-t border-slate-200 bg-white px-6 py-4 md:hidden">
          <nav className="flex flex-col gap-2">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
                onClick={() => setMobileOpen(false)}
              >
                <link.icon size={16} />
                {link.label}
              </Link>
            ))}
            <Button href="/admin" size="sm" variant="primary" className="mt-2">
              Open dashboard
            </Button>
          </nav>
        </div>
      )}
    </header>
  );
}
