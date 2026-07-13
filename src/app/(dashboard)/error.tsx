"use client";

import { Card } from "@/components/ui/card";
import Link from "next/link";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-4">
      <Card className="mx-auto w-full max-w-md text-center">
        <div className="mb-4 text-4xl">⚠</div>
        <h1 className="text-xl font-semibold tracking-tight">
          Ein Fehler ist aufgetreten
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Bitte versuchen Sie es erneut oder kontaktieren Sie den Administrator.
        </p>
        {error.digest ? (
          <p className="mt-2 font-mono text-xs text-muted-foreground/60">
            Fehler-ID: {error.digest}
          </p>
        ) : null}
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            onClick={reset}
            className="rounded-2xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
          >
            Erneut versuchen
          </button>
          <Link
            href="/receipts"
            className="rounded-2xl border border-border bg-card px-5 py-2.5 text-sm font-semibold transition hover:border-primary/40 hover:text-primary"
          >
            Zur Startseite
          </Link>
        </div>
      </Card>
    </div>
  );
}
