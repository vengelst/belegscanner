"use client";

import {
  formatLocalizedNumber,
  isLineItemActive,
  sumActiveLineItems,
  type ExcludableLineItem,
} from "@/lib/receipts/form-helpers";

export type EditableInvoiceLineItem = ExcludableLineItem & {
  lineNumber: number | null;
  description: string;
  quantity: number | null;
  unit: string | null;
  unitPrice: number | null;
  totalPrice: number | null;
  taxHint: string | null;
  status: "confident" | "uncertain" | "partial";
};

export type EditableSimpleLineItem = ExcludableLineItem & {
  label: string;
  amount: number | null;
};

const statusLabels: Record<EditableInvoiceLineItem["status"], string> = {
  confident: "sicher",
  uncertain: "pruefen",
  partial: "teilweise",
};

function formatMoney(value: number | null, currency: string | null) {
  if (value === null) return "-";
  return `${formatLocalizedNumber(value)} ${currency ?? ""}`.trim();
}

function ExcludeToggle({ excluded, onToggle }: { excluded: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={excluded}
      className={`shrink-0 rounded-2xl border px-3 py-1.5 text-[11px] font-semibold transition ${
        excluded
          ? "border-primary/30 bg-primary/5 text-primary hover:bg-primary/10"
          : "border-border bg-background text-muted-foreground hover:border-danger/40 hover:text-danger"
      }`}
    >
      {excluded ? "Wieder übernehmen" : "Nicht übernehmen"}
    </button>
  );
}

function LineItemsSummary({
  totalCount,
  activeCount,
  activeSum,
  currency,
}: {
  totalCount: number;
  activeCount: number;
  activeSum: number | null;
  currency: string | null;
}) {
  return (
    <p className="text-[11px] text-muted-foreground">
      Aktive Positionen: {activeCount} von {totalCount}
      {activeSum !== null ? ` · Summe ${formatMoney(activeSum, currency)}` : " · keine Betraege erkannt"}
    </p>
  );
}

export function InvoiceLineItemEditor({
  items,
  currency,
  title = "Erkannte Positionen",
  onToggleExcluded,
}: {
  items: EditableInvoiceLineItem[];
  currency: string | null;
  title?: string;
  onToggleExcluded?: (index: number) => void;
}) {
  if (!items || items.length === 0) return null;

  const summary = sumActiveLineItems(items, (item) => item.totalPrice);

  return (
    <div className="mt-3 space-y-2 text-xs text-muted-foreground">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-semibold text-foreground">{title}</p>
        <LineItemsSummary {...summary} currency={currency} />
      </div>
      {onToggleExcluded ? (
        <p className="text-[11px] text-muted-foreground">
          Positionen, die nicht zur Firma gehoeren, koennen deaktiviert werden. Der Rechnungsbetrag wird
          dann aus den aktiven Positionen neu berechnet.
        </p>
      ) : null}
      {items.map((item, index) => {
        const active = isLineItemActive(item);
        return (
          <div
            key={`${item.description}-${index}`}
            className={`rounded-xl border px-3 py-2 transition ${
              active ? "border-border/70 bg-background/70" : "border-dashed border-border bg-muted/40 opacity-70"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className={active ? "" : "line-through"}>
                <p className="text-sm font-medium text-foreground">
                  {item.lineNumber ? `${item.lineNumber}. ` : ""}{item.description}
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {[
                    item.quantity !== null ? `Menge ${item.quantity}` : null,
                    item.unit ? `Einheit ${item.unit}` : null,
                    item.unitPrice !== null ? `Einzelpreis ${formatMoney(item.unitPrice, currency)}` : null,
                    item.taxHint ? `Steuer ${item.taxHint}` : null,
                  ].filter(Boolean).join(" / ") || "Teilweise erkannt"}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-2">
                <div className="text-right">
                  <p className={`text-sm font-semibold text-foreground ${active ? "" : "line-through"}`}>
                    {formatMoney(item.totalPrice, currency)}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {active ? statusLabels[item.status] : "nicht uebernommen"}
                  </p>
                </div>
                {onToggleExcluded ? (
                  <ExcludeToggle excluded={!active} onToggle={() => onToggleExcluded(index)} />
                ) : null}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function SimpleLineItemEditor({
  items,
  title,
  currency = null,
  onToggleExcluded,
}: {
  items: EditableSimpleLineItem[];
  title: string;
  currency?: string | null;
  onToggleExcluded?: (index: number) => void;
}) {
  if (!items || items.length === 0) return null;

  const summary = sumActiveLineItems(items, (item) => item.amount);

  return (
    <div className="mt-3 space-y-1 text-xs text-muted-foreground">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-semibold text-foreground">{title}</p>
        <LineItemsSummary {...summary} currency={currency} />
      </div>
      {items.map((item, index) => {
        const active = isLineItemActive(item);
        return (
          <div
            key={`${item.label}-${index}`}
            className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2 transition ${
              active ? "border-border/70 bg-background/70" : "border-dashed border-border bg-muted/40 opacity-70"
            }`}
          >
            <span className={active ? "" : "line-through"}>{item.label}</span>
            <div className="flex shrink-0 items-center gap-2">
              <span className={active ? "" : "line-through"}>{formatMoney(item.amount, currency)}</span>
              {onToggleExcluded ? (
                <ExcludeToggle excluded={!active} onToggle={() => onToggleExcluded(index)} />
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
