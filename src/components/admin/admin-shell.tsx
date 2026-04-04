import type { Route } from "next";
import Link from "next/link";

type NavGroup = {
  title?: string;
  links: Array<{ href: Route; label: string }>;
};

const navGroups: NavGroup[] = [
  {
    links: [
      { href: "/admin/dashboard", label: "Dashboard" },
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
      { href: "/admin/reports", label: "Reporting" },
    ],
  },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid gap-6 xl:grid-cols-[16rem_minmax(0,1fr)]">
      <aside className="rounded-[calc(var(--radius)+0.5rem)] border border-border bg-card p-4 shadow-soft">
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
                  className="block rounded-xl px-3 py-2 text-sm font-medium transition hover:bg-primary/5 hover:text-primary"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </aside>
      <section>{children}</section>
    </div>
  );
}
