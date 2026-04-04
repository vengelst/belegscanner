"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import {
  adminNav,
  NAVIGATION_DISPLAY_STORAGE_KEY,
  type NavItem,
  type NavigationDisplayMode,
  primaryNav,
  settingsNavItem,
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
  const leftItems = userRole === "ADMIN" ? [...primaryNav, ...adminNav] : primaryNav;

  return (
    <nav className={cn("mt-4 flex items-start gap-2", iconOnly ? "flex-wrap" : "flex-wrap")}>
      <div className={cn("gap-2", iconOnly ? "flex flex-wrap" : "grid grid-cols-2 sm:flex sm:flex-wrap")}>
        {leftItems.map((item) => (
          <NavLink key={item.href} item={item} iconOnly={iconOnly} userRole={userRole} />
        ))}
      </div>
      <div className="ml-auto">
        <NavLink item={settingsNavItem} iconOnly={iconOnly} userRole={userRole} />
      </div>
    </nav>
  );
}

function NavLink({
  item,
  iconOnly,
  userRole,
}: {
  item: NavItem;
  iconOnly: boolean;
  userRole: "ADMIN" | "USER";
}) {
  return (
    <Link
      href={item.href}
      aria-label={item.label}
      title={item.label}
      className={cn(
        "rounded-2xl border border-border/80 bg-background/80 text-sm font-medium transition hover:border-primary/40 hover:bg-primary/5 hover:text-primary",
        iconOnly ? "block px-3 py-3" : "block px-4 py-3 text-left",
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
  );
}
