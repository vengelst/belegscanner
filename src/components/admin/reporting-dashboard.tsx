"use client";

import { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/card";

type SummaryData = {
  totalReceipts: number;
  totalAmountEur: number;
  failedSends: number;
  foreignCurrencyReceipts: number;
  byStatus: { status: string; count: number }[];
  byUser: { userName: string; count: number; sumEur: number }[];
  byCountry: { name: string; count: number; sumEur: number }[];
  byPurpose: { name: string; count: number; sumEur: number }[];
  byCategory: { name: string; count: number; sumEur: number }[];
  byCurrency: { currency: string; count: number; sumOriginal: number }[];
};

const STATUS_LABELS: Record<string, string> = {
  OPEN: "Offen", READY: "Bereit", SENT: "Gesendet", FAILED: "Fehlgeschlagen", RETRY: "Erneut",
};

const fmtEur = (n: number) =>
  n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " EUR";

export function ReportingDashboard() {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [data, setData] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    const res = await fetch(`/api/reports/summary?${params}`);
    if (res.ok) setData(await res.json());
    setLoading(false);
  }, [dateFrom, dateTo]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <p className="text-sm font-medium uppercase tracking-[0.24em] text-muted-foreground">Auswertung</p>
        <h1 className="text-3xl font-semibold tracking-tight">Reporting</h1>
      </div>

      {/* Date filter */}
      <Card className="flex flex-wrap items-end gap-4 p-4">
        <label className="grid gap-1 text-sm font-medium">
          <span className="text-xs text-muted-foreground">Von</span>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-9 rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary" />
        </label>
        <label className="grid gap-1 text-sm font-medium">
          <span className="text-xs text-muted-foreground">Bis</span>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-9 rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary" />
        </label>
        {(dateFrom || dateTo) ? (
          <button type="button" onClick={() => { setDateFrom(""); setDateTo(""); }} className="h-9 rounded-xl border border-border px-3 text-sm text-muted-foreground hover:text-danger">
            Zuruecksetzen
          </button>
        ) : null}
      </Card>

      {loading ? (
        <p className="text-sm text-muted-foreground">Daten werden geladen...</p>
      ) : data ? (
        <>
          {/* KPIs */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard label="Belege" value={String(data.totalReceipts)} />
            <KpiCard label="Summe EUR" value={fmtEur(data.totalAmountEur)} />
            <KpiCard label="Versandfehler" value={String(data.failedSends)} danger={data.failedSends > 0} />
            <KpiCard label="Fremdwaehrungsbelege" value={String(data.foreignCurrencyReceipts)} />
          </div>

          {/* Tables */}
          <div className="grid gap-6 lg:grid-cols-2">
            <GroupTable title="Nach Status" rows={data.byStatus.map((s) => ({ name: STATUS_LABELS[s.status] ?? s.status, count: s.count }))} />
            <CurrencyTable rows={data.byCurrency} />
            <GroupTable title="Nach Benutzer" rows={data.byUser.map((u) => ({ name: u.userName, count: u.count, sumEur: u.sumEur }))} showSum />
            <GroupTable title="Nach Zweck" rows={data.byPurpose.map((p) => ({ name: p.name, count: p.count, sumEur: p.sumEur }))} showSum />
            <GroupTable title="Nach Kategorie" rows={data.byCategory.map((c) => ({ name: c.name, count: c.count, sumEur: c.sumEur }))} showSum />
            <GroupTable title="Nach Land" rows={data.byCountry.map((c) => ({ name: c.name, count: c.count, sumEur: c.sumEur }))} showSum />
          </div>
        </>
      ) : (
        <p className="text-sm text-danger">Daten konnten nicht geladen werden.</p>
      )}
    </div>
  );
}

function KpiCard({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className="rounded-[calc(var(--radius)+0.5rem)] border border-border/80 bg-card p-5 shadow-soft">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`mt-2 text-2xl font-semibold tabular-nums ${danger ? "text-danger" : "text-foreground"}`}>{value}</p>
    </div>
  );
}

function GroupTable({ title, rows, showSum }: { title: string; rows: { name: string; count: number; sumEur?: number }[]; showSum?: boolean }) {
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

function CurrencyTable({ rows }: { rows: { currency: string; count: number; sumOriginal: number }[] }) {
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
