import { Card } from "@/components/ui/card";
import { fmtEur } from "./format-utils";

export type PeriodSelectorCardProps = {
  title: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  summary: { count: number; sumEur: number } | null;
  rows?: { key: string; label: string; count: number; sumEur: number }[];
  listTitle?: string;
};

export function PeriodSelectorCard({
  title,
  label,
  value,
  onChange,
  options,
  summary,
  rows,
  listTitle,
}: PeriodSelectorCardProps) {
  return (
    <Card className="space-y-4 p-4">
      <div className="space-y-3">
        <h3 className="text-sm font-semibold">{title}</h3>
        <label className="grid gap-1 text-sm font-medium">
          <span className="text-xs text-muted-foreground">{label} waehlen</span>
          <select
            value={value}
            onChange={(event) => onChange(event.target.value)}
            className="h-10 rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary"
          >
            {options.length === 0 ? <option value="">Keine Daten</option> : null}
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      {summary ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-border bg-muted/20 p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Anzahl</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums">{summary.count}</p>
          </div>
          <div className="rounded-2xl border border-border bg-muted/20 p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Gesamtsumme</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums">{fmtEur(summary.sumEur)}</p>
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Keine Daten fuer diese Auswahl.</p>
      )}
      {rows && rows.length > 0 ? (
        <div className="overflow-hidden rounded-2xl border border-border/80">
          <div className="border-b border-border bg-muted/20 px-4 py-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{listTitle ?? "Eintraege"}</h4>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/70 text-left text-muted-foreground">
                <th className="px-4 py-2 font-medium">{label}</th>
                <th className="px-4 py-2 text-right font-medium">Anzahl</th>
                <th className="px-4 py-2 text-right font-medium">Summe EUR</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key} className={row.key === value ? "bg-primary/5" : undefined}>
                  <td className="px-4 py-2">{row.label}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{row.count}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{fmtEur(row.sumEur)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </Card>
  );
}
