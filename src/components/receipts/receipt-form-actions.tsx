"use client";

type Props = {
  isPending: boolean;
  isPreparingAsset: boolean;
};

export function ReceiptFormActions({ isPending, isPreparingAsset }: Props) {
  return (
    <div className="flex flex-wrap gap-3">
      <button
        type="submit"
        name="_action"
        value="save"
        disabled={isPending || isPreparingAsset}
        className="rounded-2xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending ? "Wird gespeichert..." : "Speichern"}
      </button>
      <button
        type="submit"
        name="_action"
        value="save_next"
        disabled={isPending || isPreparingAsset}
        className="rounded-2xl border border-border bg-card px-6 py-3 text-sm font-semibold transition hover:border-primary/40 hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending ? "Wird vorbereitet..." : "Speichern & naechsten Beleg erfassen"}
      </button>
      <button
        type="submit"
        name="_action"
        value="send"
        disabled={isPending || isPreparingAsset}
        className="rounded-2xl border border-primary bg-primary/10 px-6 py-3 text-sm font-semibold text-primary transition hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending ? "Wird gesendet..." : "Speichern & Senden"}
      </button>
    </div>
  );
}
