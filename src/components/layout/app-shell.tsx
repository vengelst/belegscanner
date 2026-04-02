import type { Route } from "next";
import Link from "next/link";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { LogoutButton } from "@/components/auth/logout-button";
import { cn } from "@/lib/utils";

type NavItem = {
  href: Route;
  label: string;
  icon: React.ReactNode;
  accentClassName: string;
};

function ReceiptStackIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
      <path
        d="M8 5.75h8a1.75 1.75 0 0 1 1.75 1.75v9A1.75 1.75 0 0 1 16 18.25H8A1.75 1.75 0 0 1 6.25 16.5v-9A1.75 1.75 0 0 1 8 5.75Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M9.5 9.25h5M9.5 12h5M9.5 14.75h3.25"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
      <path
        d="M4.75 8.25V15.5A2.75 2.75 0 0 0 7.5 18.25"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function CaptureIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
      <path
        d="M8 6.25h5.75L17.75 10v7.5A1.75 1.75 0 0 1 16 19.25H8A1.75 1.75 0 0 1 6.25 17.5v-9A1.75 1.75 0 0 1 8 6.25Z"
        fill="none"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path
        d="M13.75 6.25V10H17.5"
        fill="none"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path
        d="M12 11.25v4.5M9.75 13.5h4.5"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
      <path
        d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M19 12a7 7 0 0 0-.08-1l1.83-1.42-1.75-3.03-2.24.77a7.5 7.5 0 0 0-1.72-1l-.34-2.34H10.3l-.34 2.34a7.5 7.5 0 0 0-1.72 1L6 6.55 4.25 9.58 6.08 11a7 7 0 0 0 0 2l-1.83 1.42L6 17.45l2.24-.77c.53.41 1.11.75 1.72 1l.34 2.34h3.4l.34-2.34c.61-.25 1.19-.59 1.72-1l2.24.77 1.75-3.03L18.92 13c.05-.33.08-.66.08-1Z"
        fill="none"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

const commonNav: NavItem[] = [
  {
    href: "/receipts",
    label: "Belege",
    icon: <ReceiptStackIcon />,
    accentClassName: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
  },
  {
    href: "/receipts/new",
    label: "Erfassen",
    icon: <CaptureIcon />,
    accentClassName: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  },
  {
    href: "/settings",
    label: "Einstellungen",
    icon: <SettingsIcon />,
    accentClassName: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
  },
];

type AppShellProps = {
  children: React.ReactNode;
  userName: string;
  userRole: "ADMIN" | "USER";
};

export function AppShell({ children, userName, userRole }: AppShellProps) {
  const navItems = commonNav;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-4 pb-8 pt-4 sm:px-6 lg:px-8">
        <header className="rounded-[calc(var(--radius)+0.75rem)] border border-border/80 bg-card/90 px-4 py-4 shadow-soft backdrop-blur sm:px-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-1">
              <Link href="/receipts" className="text-lg font-semibold tracking-tight">
                BelegBox
              </Link>
              <p className="text-sm text-muted-foreground">
                Angemeldet als{" "}
                <span className="font-medium text-foreground">{userName}</span>
                {userRole === "ADMIN" ? (
                  <span className="ml-1.5 inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                    Admin
                  </span>
                ) : null}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <LogoutButton />
            </div>
          </div>
          <nav className="mt-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded-2xl border border-border/80 bg-background/80 px-4 py-3 text-left text-sm font-medium",
                  "transition hover:border-primary/40 hover:bg-primary/5 hover:text-primary",
                )}
              >
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
                    {item.label === "Einstellungen" && userRole === "ADMIN" ? (
                      <span className="text-xs text-muted-foreground">inkl. Admin</span>
                    ) : null}
                  </span>
                </span>
              </Link>
            ))}
          </nav>
        </header>
        <main className="flex-1 py-6">{children}</main>
      </div>
    </div>
  );
}
