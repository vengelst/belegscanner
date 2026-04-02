"use client";

import type { Route } from "next";
import Link from "next/link";
import { cn } from "@/lib/utils";

type SettingsMode = "personal" | "admin";

type SettingsModeSwitchProps = {
  active: SettingsMode;
  showAdmin: boolean;
};

function PersonIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
      <path
        d="M12 12a3.75 3.75 0 1 0 0-7.5 3.75 3.75 0 0 0 0 7.5Zm-6 7.25a6 6 0 0 1 12 0"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
      <path
        d="M12 3.75 6.75 6v4.8c0 3.53 2.16 6.83 5.25 8.45 3.09-1.62 5.25-4.92 5.25-8.45V6L12 3.75Z"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

const baseLinkClassName =
  "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition";

const activeClassName = "border-primary/30 bg-primary/10 text-primary";
const inactiveClassName =
  "border-border bg-background text-muted-foreground hover:border-primary/25 hover:text-foreground";

export function SettingsModeSwitch({ active, showAdmin }: SettingsModeSwitchProps) {
  const items: Array<{
    href: Route;
    label: string;
    value: SettingsMode;
    icon: React.ReactNode;
  }> = [
    {
      href: "/settings",
      label: "Persoenlich",
      value: "personal",
      icon: <PersonIcon />,
    },
  ];

  if (showAdmin) {
    items.push({
      href: "/admin/settings",
      label: "Admin",
      value: "admin",
      icon: <ShieldIcon />,
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={cn(baseLinkClassName, active === item.value ? activeClassName : inactiveClassName)}
        >
          {item.icon}
          <span>{item.label}</span>
        </Link>
      ))}
    </div>
  );
}
