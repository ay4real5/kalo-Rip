"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Phone, LayoutDashboard, CalendarDays, Menu, X, User, LogOut } from "lucide-react";
import { Button } from "@/app/components/ui/Button";
import { createClient } from "@/app/lib/supabase/client";

interface UserProfile {
  email?: string;
  name?: string | null;
  role?: string;
}

export function NavBar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUser({
          email: user.email,
          name: user.user_metadata?.name,
          role: user.user_metadata?.role,
        });
      }
      setLoading(false);
    });
  }, []);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/";
  }

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

        <div className="hidden items-center gap-3 md:flex">
          {!loading && (
            user ? (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700">
                  <User size={14} />
                  <span className="max-w-[120px] truncate">{user.name ?? user.email}</span>
                  {user.role && (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700 capitalize">
                      {user.role}
                    </span>
                  )}
                </div>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                >
                  <LogOut size={16} />
                  Log out
                </button>
              </div>
            ) : (
              <>
                <Link
                  href="/login"
                  className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                >
                  Sign in
                </Link>
                <Button href="/register" size="sm" variant="primary">
                  Get started
                </Button>
              </>
            )
          )}
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
            {user ? (
              <button
                onClick={() => {
                  setMobileOpen(false);
                  handleLogout();
                }}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
              >
                <LogOut size={16} />
                Log out
              </button>
            ) : (
              <>
                <Link href="/login" className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">
                  Sign in
                </Link>
                <Button href="/register" size="sm" variant="primary" className="mt-2">
                  Get started
                </Button>
              </>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
