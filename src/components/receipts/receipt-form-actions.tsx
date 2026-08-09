"use client";

import { Button } from "@/components/ui/button";

type Props = {
  isPending: boolean;
  isPreparingAsset: boolean;
};

export function ReceiptFormActions({ isPending, isPreparingAsset }: Props) {
  const disabled = isPending || isPreparingAsset;

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        <span className="font-medium text-foreground">Speichern</span> legt den Beleg im System ab — nacharbeitbar.
        {" "}
        <span className="font-medium text-foreground">Speichern &amp; Uebertragen</span> verarbeitet und schliesst den Beleg.
      </p>
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
          {isPending ? "Wird uebertragen..." : "Speichern & Uebertragen"}
        </Button>
      </div>
    </div>
  );
}
