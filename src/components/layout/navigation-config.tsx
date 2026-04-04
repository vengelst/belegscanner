import type { Route } from "next";

export type NavigationDisplayMode = "icons" | "text";

export type NavItem = {
  href: Route;
  label: string;
  shortLabel?: string;
  icon: React.ReactNode;
  accentClassName: string;
  adminHint?: string;
};

export const NAVIGATION_DISPLAY_STORAGE_KEY = "belegbox-navigation-display";

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

function ReportsIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
      <path
        d="M6.75 18.25h10.5A1.75 1.75 0 0 0 19 16.5v-9A1.75 1.75 0 0 0 17.25 5.75H6.75A1.75 1.75 0 0 0 5 7.5v9c0 .97.78 1.75 1.75 1.75Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M8.5 15.5V12.5M12 15.5v-6M15.5 15.5v-4"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

export const primaryNav: NavItem[] = [
  {
    href: "/receipts/new",
    label: "Belegerfassung",
    shortLabel: "Erfassung",
    icon: <CaptureIcon />,
    accentClassName: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  },
  {
    href: "/receipts",
    label: "Beleguebersicht",
    shortLabel: "Uebersicht",
    icon: <ReceiptStackIcon />,
    accentClassName: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
  },
];

export const adminNav: NavItem[] = [
  {
    href: "/admin/reports",
    label: "Auswertung",
    shortLabel: "Auswertung",
    icon: <ReportsIcon />,
    accentClassName: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  },
];

export const settingsNavItem: NavItem = {
  href: "/settings",
  label: "Einstellungen",
  shortLabel: "Settings",
  icon: <SettingsIcon />,
  accentClassName: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
  adminHint: "inkl. Admin",
};
