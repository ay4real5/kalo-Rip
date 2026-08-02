import { Phone, Mail, MapPin } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="flex items-center gap-2 text-slate-900 dark:text-white">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-white">
                <Phone size={16} />
              </div>
              <span className="font-bold">Kalo Rip</span>
            </div>
            <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
              AI phone receptionist and booking platform built for driving schools.
            </p>
          </div>
          <div>
            <h4 className="font-semibold text-slate-900 dark:text-slate-100">Product</h4>
            <ul className="mt-3 space-y-2 text-sm text-slate-500 dark:text-slate-400">
              <li><a href="/admin" className="hover:text-emerald-600">Admin dashboard</a></li>
              <li><a href="/instructor" className="hover:text-emerald-600">Instructor portal</a></li>
              <li><span className="hover:text-emerald-600">Voice AI</span></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-slate-900 dark:text-slate-100">Company</h4>
            <ul className="mt-3 space-y-2 text-sm text-slate-500 dark:text-slate-400">
              <li><span className="hover:text-emerald-600">About</span></li>
              <li><span className="hover:text-emerald-600">Privacy</span></li>
              <li><span className="hover:text-emerald-600">Terms</span></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-slate-900 dark:text-slate-100">Contact</h4>
            <ul className="mt-3 space-y-2 text-sm text-slate-500 dark:text-slate-400">
              <li className="flex items-center gap-2"><Phone size={14} /> +44 741 410 4022</li>
              <li className="flex items-center gap-2"><Mail size={14} /> hello@kalo.rip</li>
              <li className="flex items-center gap-2"><MapPin size={14} /> United Kingdom</li>
            </ul>
          </div>
        </div>
        <div className="mt-10 border-t border-slate-200 pt-6 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
          © {new Date().getFullYear()} Kalo Rip. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
