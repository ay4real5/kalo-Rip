"use client";

import { Sun, Moon, Monitor } from "lucide-react";
import { useSyncExternalStore } from "react";
import { useTheme } from "@/app/components/ThemeProvider";

const subscribeMounted = () => () => {};
const getServerMounted = () => false;
const getMounted = () => true;

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(subscribeMounted, getMounted, getServerMounted);

  if (!mounted) {
    return <div className="h-8 w-[88px] rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800" />;
  }

  return (
    <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1 dark:border-slate-700 dark:bg-slate-800">
      <button
        onClick={() => setTheme("light")}
        className={`rounded-lg p-1.5 transition ${theme === "light" ? "bg-white text-emerald-600 shadow-sm dark:bg-slate-700" : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"}`}
        aria-label="Light mode"
      >
        <Sun size={16} />
      </button>
      <button
        onClick={() => setTheme("dark")}
        className={`rounded-lg p-1.5 transition ${theme === "dark" ? "bg-white text-emerald-600 shadow-sm dark:bg-slate-700" : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"}`}
        aria-label="Dark mode"
      >
        <Moon size={16} />
      </button>
      <button
        onClick={() => setTheme("system")}
        className={`rounded-lg p-1.5 transition ${theme === "system" ? "bg-white text-emerald-600 shadow-sm dark:bg-slate-700" : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"}`}
        aria-label="System preference"
      >
        <Monitor size={16} />
      </button>
    </div>
  );
}
