"use client";

import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";

type NavGroup = {
  title?: string;
  links: Array<{ href: Route; label: string }>;
};

const navGroups: NavGroup[] = [
  {
    links: [
      { href: "/admin/dashboard", label: "Uebersicht" },
      { href: "/admin/users", label: "Benutzer" },
    ],
  },
  {
    title: "Stammdaten",
    links: [
      { href: "/admin/countries", label: "Laender" },
      { href: "/admin/vehicles", label: "Kfz-Kennzeichen" },
      { href: "/admin/purposes", label: "Zwecke" },
      { href: "/admin/categories", label: "Kategorien" },
      { href: "/admin/send-status", label: "Versandstatus" },
    ],
  },
  {
    title: "System",
    links: [
      { href: "/admin/smtp", label: "SMTP" },
      { href: "/admin/datev", label: "DATEV-Profile" },
      { href: "/admin/ai" as Route, label: "KI-Einstellungen" },
      { href: "/admin/backup" as Route, label: "Backup" },
    ],
  },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="grid gap-6 xl:grid-cols-[16rem_minmax(0,1fr)]">
      <aside className="bb-card rounded-[calc(var(--radius)+0.5rem)] border border-border bg-card p-4 shadow-soft transition-shadow duration-200">
        {navGroups.map((group, index) => (
          <div key={group.title ?? `group-${index}`} className="mb-5 last:mb-0">
            {group.title ? (
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                {group.title}
              </p>
            ) : null}
            <div className="space-y-1">
              {group.links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`bb-sidebar-link bb-chip-button block w-full justify-start rounded-xl px-3 py-2 text-sm font-medium ${
                    pathname === link.href || pathname.startsWith(`${link.href}/`)
                      ? "bb-chip-button-active text-primary"
                      : ""
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </aside>
      <section className="min-w-0">{children}</section>
    </div>
  );
}
