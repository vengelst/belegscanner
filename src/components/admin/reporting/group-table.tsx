import { Card } from "@/components/ui/card";
import { fmtEur } from "./format-utils";

export type GroupTableProps = {
  title: string;
  rows: { name: string; count: number; sumEur?: number }[];
  showSum?: boolean;
};

export function GroupTable({ title, rows, showSum }: GroupTableProps) {
  return (
    <Card className="p-0 overflow-hidden">
      <div className="px-4 py-3 border-b border-border">
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-muted-foreground">
            <th className="px-4 py-2 font-medium">Name</th>
            <th className="px-4 py-2 font-medium text-right">Anzahl</th>
            {showSum ? <th className="px-4 py-2 font-medium text-right">Summe EUR</th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={showSum ? 3 : 2} className="px-4 py-3 text-muted-foreground">Keine Daten</td></tr>
          ) : rows.map((r) => (
            <tr key={r.name} className="border-b border-border/50">
              <td className="px-4 py-2">{r.name}</td>
              <td className="px-4 py-2 text-right tabular-nums">{r.count}</td>
              {showSum ? <td className="px-4 py-2 text-right tabular-nums">{fmtEur(r.sumEur ?? 0)}</td> : null}
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
