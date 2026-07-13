"use client";

import { Button } from "@/components/ui/button";

type Props = {
  isPending: boolean;
  isPreparingAsset: boolean;
};

export function ReceiptFormActions({ isPending, isPreparingAsset }: Props) {
  const disabled = isPending || isPreparingAsset;

  return (
    <div className="flex flex-wrap gap-3">
      <Button
        type="submit"
        name="_action"
        value="save"
        disabled={disabled}
        loading={isPending}
        size="lg"
      >
        Speichern
      </Button>
      <Button
        type="submit"
        name="_action"
        value="save_next"
        disabled={disabled}
        variant="secondary"
        size="lg"
      >
        {isPending ? "Wird vorbereitet..." : "Speichern & naechsten Beleg erfassen"}
      </Button>
      <Button
        type="submit"
        name="_action"
        value="send"
        disabled={disabled}
        size="lg"
        className="border border-primary bg-primary/10 text-primary hover:bg-primary/20 hover:opacity-100"
      >
        {isPending ? "Wird gesendet..." : "Speichern & Senden"}
      </Button>
    </div>
  );
}
