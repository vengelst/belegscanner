"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { getReviewStatusBadgeClass, getReviewStatusLabel } from "@/lib/receipts/review-status";

type Props = {
  receiptId: string;
  reviewStatus: string;
  isAdmin: boolean;
  reviewedByName?: string | null;
  reviewedAt?: string | null;
};

export function ReviewActions({ receiptId, reviewStatus, isAdmin, reviewedByName, reviewedAt }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleAction(action: string) {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/receipts/${receiptId}/review`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(`Status geaendert: ${getReviewStatusLabel(data.reviewStatus)}`);
      } else {
        setError(data.error ?? "Aktion fehlgeschlagen.");
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      {/* Current status */}
      <div className="flex items-center gap-3">
        <span className="text-xs text-muted-foreground">Pruefstatus:</span>
        <span className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${getReviewStatusBadgeClass(reviewStatus)}`}>
          {getReviewStatusLabel(reviewStatus)}
        </span>
      </div>

      {reviewedByName ? (
        <p className="text-xs text-muted-foreground">
          {reviewStatus === "APPROVED" ? "Freigegeben" : reviewStatus === "DEFERRED" ? "Zurueckgestellt" : "Geprueft"} von {reviewedByName}
          {reviewedAt ? ` am ${new Date(reviewedAt).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}` : ""}
        </p>
      ) : null}

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        {reviewStatus === "DRAFT" ? (
          <ActionButton label="Zur Pruefung einreichen" onClick={() => handleAction("submit")} disabled={isPending} />
        ) : null}
        {isAdmin && (reviewStatus === "IN_REVIEW" || reviewStatus === "DRAFT") ? (
          <ActionButton label="Freigeben" onClick={() => handleAction("approve")} disabled={isPending} primary />
        ) : null}
        {isAdmin && reviewStatus === "IN_REVIEW" ? (
          <ActionButton label="Zurueckstellen" onClick={() => handleAction("defer")} disabled={isPending} danger />
        ) : null}
        {isAdmin && reviewStatus === "APPROVED" ? (
          <ActionButton label="Abschliessen" onClick={() => handleAction("complete")} disabled={isPending} />
        ) : null}
        {reviewStatus === "DEFERRED" ? (
          <ActionButton label="Wieder oeffnen" onClick={() => handleAction("reopen")} disabled={isPending} />
        ) : null}
        {isAdmin && reviewStatus === "COMPLETED" ? (
          <ActionButton label="Zur Bearbeitung zurueck" onClick={() => handleAction("revert")} disabled={isPending} />
        ) : null}
      </div>

      {message ? <p className="text-xs font-medium text-primary">{message}</p> : null}
      {error ? <p className="text-xs font-medium text-danger">{error}</p> : null}
    </div>
  );
}

function ActionButton({ label, onClick, disabled, primary, danger }: {
  label: string; onClick: () => void; disabled: boolean; primary?: boolean; danger?: boolean;
}) {
  let cls = "rounded-2xl border border-border bg-card px-4 py-2 text-sm font-semibold transition hover:border-primary/40 hover:text-primary disabled:opacity-50";
  if (primary) cls = "rounded-2xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50";
  if (danger) cls = "rounded-2xl border border-danger/30 bg-danger/5 px-4 py-2 text-sm font-semibold text-danger transition hover:bg-danger/10 disabled:opacity-50";

  return <button type="button" onClick={onClick} disabled={disabled} className={cls}>{label}</button>;
}
