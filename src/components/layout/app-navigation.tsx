"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import {
  commonNav,
  NAVIGATION_DISPLAY_STORAGE_KEY,
  type NavigationDisplayMode,
} from "@/components/layout/navigation-config";

type AppNavigationProps = {
  userRole: "ADMIN" | "USER";
};

export function AppNavigation({ userRole }: AppNavigationProps) {
  const [displayMode, setDisplayMode] = useState<NavigationDisplayMode>("icons");

  useEffect(() => {
    const savedMode = window.localStorage.getItem(NAVIGATION_DISPLAY_STORAGE_KEY);
    if (savedMode === "icons" || savedMode === "text") {
      setDisplayMode(savedMode);
    }

    const handleModeChange = (event: Event) => {
      const nextMode = (event as CustomEvent<NavigationDisplayMode>).detail;
      if (nextMode === "icons" || nextMode === "text") {
        setDisplayMode(nextMode);
      }
    };

    window.addEventListener("belegbox-navigation-display-changed", handleModeChange as EventListener);
    return () => {
      window.removeEventListener("belegbox-navigation-display-changed", handleModeChange as EventListener);
    };
  }, []);

  const iconOnly = displayMode === "icons";

  return (
    <nav className={cn("mt-4 gap-2", iconOnly ? "flex flex-wrap" : "grid grid-cols-2 sm:flex sm:flex-wrap")}>
      {commonNav.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-label={item.label}
          title={item.label}
          className={cn(
            "rounded-2xl border border-border/80 bg-background/80 text-sm font-medium transition hover:border-primary/40 hover:bg-primary/5 hover:text-primary",
            iconOnly ? "px-3 py-3" : "px-4 py-3 text-left",
          )}
        >
          {iconOnly ? (
            <span
              className={cn(
                "inline-flex h-9 w-9 items-center justify-center rounded-2xl",
                item.accentClassName,
              )}
            >
              {item.icon}
            </span>
          ) : (
            <span className="flex items-center gap-3">
              <span
                className={cn(
                  "inline-flex h-9 w-9 items-center justify-center rounded-2xl",
                  item.accentClassName,
                )}
              >
                {item.icon}
              </span>
              <span className="flex flex-col">
                <span>{item.label}</span>
                {item.href === "/settings" && userRole === "ADMIN" && item.adminHint ? (
                  <span className="text-xs text-muted-foreground">{item.adminHint}</span>
                ) : null}
              </span>
            </span>
          )}
        </Link>
      ))}
    </nav>
  );
}
