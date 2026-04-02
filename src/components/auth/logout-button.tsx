"use client";

import { signOut } from "next-auth/react";

export function LogoutButton() {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: "/login" })}
      className="inline-flex h-10 items-center rounded-full border border-border bg-card px-4 text-sm font-medium text-card-foreground shadow-soft transition hover:border-danger/40 hover:text-danger"
    >
      Abmelden
    </button>
  );
}
