"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Props = {
  receiptId: string;
  sendStatus: string;
  datevProfiles: { id: string; name: string; isDefault: boolean }[];
};

export function SendActions({ receiptId, sendStatus, datevProfiles }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedProfile, setSelectedProfile] = useState(
    datevProfiles.find((p) => p.isDefault)?.id ?? datevProfiles[0]?.id ?? "",
  );

  const canSend = sendStatus === "OPEN" || sendStatus === "READY";
  const canRetry = sendStatus === "FAILED" || sendStatus === "SENT";

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
          Kein aktives DATEV-Profil konfiguriert. Bitte unter Admin → DATEV-Profile ein Profil anlegen.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
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
            disabled={isPending}
            className="rounded-2xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
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

      {/* Feedback */}
      {message ? <p className="text-sm font-medium text-primary">{message}</p> : null}
      {error ? <p className="text-sm font-medium text-danger">{error}</p> : null}
    </div>
  );
}
