import { fmtEur } from "./format-utils";

export type PrintSummarySectionProps = {
  title: string;
  label: string;
  rows: { key: string; label: string; count: number; sumEur: number }[];
};

export function PrintSummarySection({ title, label, rows }: PrintSummarySectionProps) {
  const totalCount = rows.reduce((sum, row) => sum + row.count, 0);
  const totalSumEur = rows.reduce((sum, row) => sum + row.sumEur, 0);

  return (
    <div className="report-print-section rounded-2xl border border-border bg-white p-5 text-black">
      <h2 className="text-base font-semibold">{title}</h2>
      <table className="mt-3 w-full text-sm">
        <thead>
          <tr className="border-b border-slate-300 text-left">
            <th className="px-2 py-1.5 font-medium">{label}</th>
            <th className="px-2 py-1.5 text-right font-medium">Anzahl</th>
            <th className="px-2 py-1.5 text-right font-medium">Summe EUR</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className="border-b border-slate-200">
              <td className="px-2 py-1.5">{row.label}</td>
              <td className="px-2 py-1.5 text-right tabular-nums">{row.count}</td>
              <td className="px-2 py-1.5 text-right tabular-nums">{fmtEur(row.sumEur)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-slate-400 font-semibold">
            <td className="px-2 py-1.5">Gesamtsumme</td>
            <td className="px-2 py-1.5 text-right tabular-nums">{totalCount}</td>
            <td className="px-2 py-1.5 text-right tabular-nums">{fmtEur(totalSumEur)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
