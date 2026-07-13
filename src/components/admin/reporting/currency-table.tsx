import { Card } from "@/components/ui/card";

export type CurrencyTableProps = {
  rows: { currency: string; count: number; sumOriginal: number }[];
};

export function CurrencyTable({ rows }: CurrencyTableProps) {
  return (
    <Card className="overflow-hidden p-0">
      <div className="border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold">Originalbetraege nach Waehrung</h3>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-muted-foreground">
            <th className="px-4 py-2 font-medium">Waehrung</th>
            <th className="px-4 py-2 font-medium text-right">Anzahl</th>
            <th className="px-4 py-2 font-medium text-right">Summe Original</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={3} className="px-4 py-3 text-muted-foreground">Keine Daten</td></tr>
          ) : rows.map((row) => (
            <tr key={row.currency} className="border-b border-border/50">
              <td className="px-4 py-2">{row.currency}</td>
              <td className="px-4 py-2 text-right tabular-nums">{row.count}</td>
              <td className="px-4 py-2 text-right tabular-nums">{row.sumOriginal.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {row.currency}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
