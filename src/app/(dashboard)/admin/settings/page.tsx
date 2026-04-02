import type { Route } from "next";
import Link from "next/link";
import { SettingsModeSwitch } from "@/components/settings/settings-mode-switch";

const adminSections: Array<{
  title: string;
  description: string;
  links: Array<{ href: Route; label: string }>;
}> = [
  {
    title: "System",
    description: "Technische und organisatorische Grundeinstellungen fuer den Produktivbetrieb.",
    links: [
      { href: "/admin/smtp", label: "SMTP" },
      { href: "/admin/datev", label: "DATEV-Profile" },
      { href: "/admin/reports", label: "Reporting" },
    ],
  },
  {
    title: "Organisation",
    description: "Benutzer und Stammdaten fuer Erfassung, Review und Versand verwalten.",
    links: [
      { href: "/admin/users", label: "Benutzer" },
      { href: "/admin/master-data", label: "Stammdaten" },
      { href: "/admin/dashboard", label: "Admin-Dashboard" },
    ],
  },
];

export default function AdminSettingsPage() {
  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <SettingsModeSwitch active="admin" showAdmin />
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">Admin-Einstellungen</h1>
          <p className="text-sm text-muted-foreground">
            Zentrale Verwaltung fuer System, Versand, Benutzer und Stammdaten.
          </p>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {adminSections.map((section) => (
          <section
            key={section.title}
            className="rounded-[calc(var(--radius)+0.5rem)] border border-border bg-card p-6 shadow-soft"
          >
            <div className="space-y-2">
              <h2 className="text-xl font-semibold tracking-tight">{section.title}</h2>
              <p className="text-sm text-muted-foreground">{section.description}</p>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              {section.links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="rounded-full border border-border bg-background px-4 py-2 text-sm font-medium transition hover:border-primary/30 hover:bg-primary/5 hover:text-primary"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
