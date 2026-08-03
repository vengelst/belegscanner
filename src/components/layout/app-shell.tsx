import Link from "next/link";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { LogoutButton } from "@/components/auth/logout-button";
import { AppNavigation } from "@/components/layout/app-navigation";
import { InstallPrompt } from "@/components/pwa/install-prompt";
import { cn } from "@/lib/utils";
import type { UiTemplate } from "@/lib/validation";

type AppShellProps = {
  children: React.ReactNode;
  userName: string;
  userRole: "ADMIN" | "USER";
  uiTemplate?: UiTemplate;
};

export function AppShell({ children, userName, userRole, uiTemplate = "classic" }: AppShellProps) {
  const isModern = uiTemplate === "modern";
  
  return (
    <div className={cn(
      "min-h-screen bg-background text-foreground",
      isModern && "template-modern"
    )}>
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-4 pb-8 pt-4 sm:px-6 lg:px-8">
        <header className={cn(
          "px-4 py-4 sm:px-6",
          isModern 
            ? "neu-header" 
            : "rounded-[calc(var(--radius)+0.75rem)] border border-border/80 bg-card/90 shadow-soft backdrop-blur"
        )}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-1">
              <Link href="/receipts" className="text-lg font-semibold tracking-tight">
                BelegBox
              </Link>
              <p className="text-sm text-muted-foreground">
                Angemeldet als{" "}
                <span className="font-medium text-foreground">{userName}</span>
                {userRole === "ADMIN" ? (
                  <span className={cn(
                    "ml-1.5 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold",
                    isModern
                      ? "bg-primary text-primary-foreground"
                      : "bg-primary/10 text-primary"
                  )}>
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
          <AppNavigation userRole={userRole} uiTemplate={uiTemplate} />
        </header>
        <main className="flex-1 py-6">{children}</main>
      </div>
      <InstallPrompt />
    </div>
  );
}
