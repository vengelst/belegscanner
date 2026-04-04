"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { SendReadiness } from "@/lib/validation";

type Props = {
  receiptId: string;
  sendStatus: string;
  reviewStatus: string;
  isAdmin: boolean;
  datevProfiles: { id: string; name: string; isDefault: boolean }[];
  receiptDatevProfileId?: string | null;
  readiness?: SendReadiness;
};

const statusLabels: Record<SendReadiness["status"], string> = {
  sendbar: "An DATEV sendbar",
  pruefen: "An DATEV sendbar — intern noch zu pruefen",
  nicht_sendbar: "Technisch nicht sendbar",
};

const statusColors: Record<SendReadiness["status"], string> = {
  sendbar: "border-primary/30 bg-primary/5 text-primary",
  pruefen: "border-accent/30 bg-accent/5 text-accent-foreground",
  nicht_sendbar: "border-danger/30 bg-danger/5 text-danger",
};

export function SendActions({ receiptId, sendStatus, reviewStatus, isAdmin, datevProfiles, receiptDatevProfileId, readiness }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Receipt's own profile takes priority, then global default, then first available
  const [selectedProfile, setSelectedProfile] = useState(
    (receiptDatevProfileId && datevProfiles.some((p) => p.id === receiptDatevProfileId) ? receiptDatevProfileId : null)
      ?? datevProfiles.find((p) => p.isDefault)?.id
      ?? datevProfiles[0]?.id
      ?? "",
  );

  const canSend = sendStatus === "OPEN" || sendStatus === "READY";
  const canRetry = sendStatus === "FAILED" || sendStatus === "SENT";
  const isBlocked = readiness?.status === "nicht_sendbar";
  const needsApproval = !isAdmin && reviewStatus !== "APPROVED";

  function handleSend() {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/receipts/${receiptId}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(selectedProfile ? { datevProfileId: selectedProfile } : {}),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(data.message);
      } else {
        setError(data.error ?? "Versand fehlgeschlagen.");
      }
      router.refresh();
    });
  }

  function handleRetry() {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/receipts/${receiptId}/retry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(selectedProfile ? { datevProfileId: selectedProfile } : {}),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(data.message);
      } else {
        setError(data.error ?? "Erneuter Versand fehlgeschlagen.");
      }
      router.refresh();
    });
  }

  if (datevProfiles.length === 0) {
    return (
      <div className="rounded-2xl border border-danger/30 bg-danger/5 p-4">
        <p className="text-sm font-medium text-danger">
          Kein aktives DATEV-Profil konfiguriert. Bitte unter Admin &rarr; DATEV-Profile ein Profil anlegen.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Readiness status */}
      {readiness && canSend ? (
        <div className={`rounded-2xl border p-4 ${statusColors[readiness.status]}`}>
          <p className="text-sm font-semibold">{statusLabels[readiness.status]}</p>
          {readiness.issues.length > 0 ? (
            <ul className="mt-2 space-y-1">
              {readiness.issues.map((issue) => (
                <li key={issue.field} className="flex items-start gap-2 text-sm">
                  <span className="mt-0.5 shrink-0">
                    {issue.severity === "error" ? "\u2717" : "\u26A0"}
                  </span>
                  <span>{issue.message}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {/* Review gate warning */}
      {canSend && needsApproval ? (
        <div className="rounded-2xl border border-accent/30 bg-accent/5 p-4">
          <p className="text-sm font-medium text-accent-foreground">
            Versand erfordert Freigabe. Bitte den Beleg zuerst zur Pruefung einreichen und freigeben lassen.
          </p>
        </div>
      ) : null}

      {/* Profile selector */}
      {datevProfiles.length > 1 ? (
        <label className="grid gap-1 text-sm font-medium">
          <span className="text-xs text-muted-foreground">DATEV-Profil</span>
          <select
            value={selectedProfile}
            onChange={(e) => setSelectedProfile(e.target.value)}
            className="h-10 rounded-2xl border border-border bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
          >
            {datevProfiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}{p.isDefault ? " (Standard)" : ""}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        {canSend ? (
          <button
            type="button"
            onClick={handleSend}
            disabled={isPending || isBlocked || needsApproval}
            title={isBlocked ? "Bitte fehlende Pflichtfelder ergaenzen" : needsApproval ? "Freigabe erforderlich" : undefined}
            className="rounded-2xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending ? "Wird gesendet..." : "Jetzt senden"}
          </button>
        ) : null}
        {canRetry ? (
          <button
            type="button"
            onClick={handleRetry}
            disabled={isPending}
            className="rounded-2xl border border-border bg-card px-5 py-2.5 text-sm font-semibold transition hover:border-primary/40 hover:text-primary disabled:opacity-50"
          >
            {isPending ? "Wird gesendet..." : "Erneut senden"}
          </button>
        ) : null}
      </div>

      {/* Send result feedback */}
      {message ? (
        <div className="rounded-2xl border border-primary/30 bg-primary/5 p-3">
          <p className="text-sm font-medium text-primary">{message}</p>
        </div>
      ) : null}
      {error ? (
        <div className="rounded-2xl border border-danger/30 bg-danger/5 p-3">
          <p className="text-sm font-medium text-danger">{error}</p>
        </div>
      ) : null}
    </div>
  );
}
