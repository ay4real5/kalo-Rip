"use client";

import { createContext, useContext, useEffect, useMemo, useSyncExternalStore, useState } from "react";

type Theme = "light" | "dark" | "system";

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  resolved: "light" | "dark";
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "system",
  setTheme: () => {},
  resolved: "light",
});

export function useTheme() {
  return useContext(ThemeContext);
}

function getSavedTheme(): Theme {
  if (typeof window === "undefined") return "system";
  const saved = localStorage.getItem("kalo-theme") as Theme | null;
  return saved && ["light", "dark", "system"].includes(saved) ? saved : "system";
}

function subscribeMedia(callback: () => void) {
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}

function getSystemDark() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(getSavedTheme);
  const systemDark = useSyncExternalStore(subscribeMedia, getSystemDark, () => false);

  const resolved = useMemo<"light" | "dark">(
    () => (theme === "dark" || (theme === "system" && systemDark) ? "dark" : "light"),
    [theme, systemDark]
  );

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.toggle("dark", resolved === "dark");
    localStorage.setItem("kalo-theme", theme);
  }, [resolved, theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolved }}>
      {children}
    </ThemeContext.Provider>
  );
}
