"use client";

import { useTheme } from "next-themes";

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
      <circle cx="12" cy="12" r="4" fill="currentColor" />
      <path
        d="M12 2.75v2.5M12 18.75v2.5M21.25 12h-2.5M5.25 12h-2.5M18.54 5.46l-1.77 1.77M7.23 16.77l-1.77 1.77M18.54 18.54l-1.77-1.77M7.23 7.23 5.46 5.46"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
      <path
        d="M14.5 3.5a8.5 8.5 0 1 0 6 14.5A9 9 0 0 1 14.5 3.5Z"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

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
      <span
        className={`mr-2 inline-flex h-7 w-7 items-center justify-center rounded-full ${
          isDark
            ? "bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300"
            : "bg-indigo-100 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300"
        }`}
      >
        {isDark ? <SunIcon /> : <MoonIcon />}
      </span>
      {isDark ? "Hellmodus" : "Dunkelmodus"}
    </button>
  );
}

