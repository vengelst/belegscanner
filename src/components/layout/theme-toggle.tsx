"use client";

import { useTheme } from "next-themes";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="inline-flex h-10 items-center rounded-full border border-border bg-card px-4 text-sm font-medium text-card-foreground shadow-soft transition hover:border-primary/40 hover:text-primary"
      aria-label="Farbschema wechseln"
    >
      {isDark ? "Hellmodus" : "Dunkelmodus"}
    </button>
  );
}

