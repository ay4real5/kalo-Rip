import Link from "next/link";
import { Phone, LayoutDashboard, CalendarDays } from "lucide-react";

export function NavBar() {
  return (
    <header className="border-b border-zinc-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-2 text-zinc-900">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-white">
            <Phone size={18} />
          </div>
          <span className="text-lg font-bold tracking-tight">Kalo Rip</span>
        </Link>
        <nav className="flex items-center gap-1">
          <Link
            href="/admin"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
          >
            <LayoutDashboard size={16} />
            Admin
          </Link>
          <Link
            href="/instructor"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
          >
            <CalendarDays size={16} />
            Instructor
          </Link>
        </nav>
      </div>
    </header>
  );
}
