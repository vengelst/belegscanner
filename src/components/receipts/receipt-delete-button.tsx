"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/ui/dialog";

export function ReceiptDeleteButton({ receiptId }: { receiptId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      const response = await fetch(`/api/receipts/${receiptId}`, { method: "DELETE" });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        const message =
          data && typeof data === "object" && "error" in data
            ? String(data.error)
            : "Beleg konnte nicht geloescht werden.";
        setError(message);
        return;
      }
      setOpen(false);
      router.push("/receipts");
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="bb-chip-button rounded-2xl px-4 py-2 text-sm text-danger"
      >
        Loeschen
      </button>
      <ConfirmDialog
        open={open}
        onClose={() => {
          if (!isPending) setOpen(false);
        }}
        onConfirm={handleConfirm}
        title="Beleg loeschen"
        message="Diesen Beleg wirklich loeschen? Diese Aktion kann nicht rueckgaengig gemacht werden."
        confirmLabel="Loeschen"
        variant="danger"
        loading={isPending}
      />
      {error ? <p className="w-full text-xs font-medium text-danger">{error}</p> : null}
    </>
  );
}
