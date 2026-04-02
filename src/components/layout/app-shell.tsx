import Link from "next/link";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { LogoutButton } from "@/components/auth/logout-button";
import { AppNavigation } from "@/components/layout/app-navigation";

type AppShellProps = {
  children: React.ReactNode;
  userName: string;
  userRole: "ADMIN" | "USER";
};

export function AppShell({ children, userName, userRole }: AppShellProps) {
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
          <AppNavigation userRole={userRole} />
        </header>
        <main className="flex-1 py-6">{children}</main>
      </div>
    </div>
  );
}
