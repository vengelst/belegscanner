"use client";

import { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/card";

type SummaryData = {
  totalReceipts: number;
  totalAmountEur: number;
  failedSends: number;
  foreignCurrencyReceipts: number;
  byStatus: { status: string; count: number }[];
  byReviewStatus: { status: string; count: number }[];
  byDay: { day: string; count: number; sumEur: number }[];
  byWeek: { weekStart: string; weekLabel: string; count: number; sumEur: number }[];
  byMonth: { month: string; count: number; sumEur: number }[];
  byUser: { userName: string; count: number; sumEur: number }[];
  byCountry: { name: string; count: number; sumEur: number }[];
  byPurpose: { name: string; count: number; sumEur: number }[];
  byPaymentMethod: { name: string; count: number; sumEur: number }[];
  byCurrency: { currency: string; count: number; sumOriginal: number }[];
  problems: {
    missingFile: number;
    missingCountry: number;
    missingSupplier: number;
    missingExchangeRate: number;
    sendFailed: number;
    missingHospitality: number;
    total: number;
  };
};

type PeriodMode = "day" | "week" | "month";

const STATUS_LABELS: Record<string, string> = {
  OPEN: "Offen", READY: "Bereit", SENT: "Gesendet", FAILED: "Fehlgeschlagen", RETRY: "Erneut",
};

const REVIEW_LABELS: Record<string, string> = {
  DRAFT: "Entwurf", IN_REVIEW: "In Pruefung", APPROVED: "Freigegeben", DEFERRED: "Zurueckgestellt", COMPLETED: "Abgeschlossen",
};

const fmtEur = (n: number) =>
  n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " EUR";

const MONTH_NAMES = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];

function fmtMonth(key: string) {
  const [year, month] = key.split("-");
  const idx = parseInt(month, 10) - 1;
  return `${MONTH_NAMES[idx] ?? month} ${year}`;
}

function fmtDay(key: string) {
  const [year, month, day] = key.split("-");
  return `${day}.${month}.${year}`;
}

export function ReportingDashboard() {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [data, setData] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [periodMode, setPeriodMode] = useState<PeriodMode>("month");

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

  const periodRows = data
    ? periodMode === "day"
      ? data.byDay.map((d) => ({ key: d.day, label: fmtDay(d.day), count: d.count, sumEur: d.sumEur }))
      : periodMode === "week"
        ? data.byWeek.map((w) => ({ key: w.weekStart, label: w.weekLabel, count: w.count, sumEur: w.sumEur }))
        : data.byMonth.map((m) => ({ key: m.month, label: fmtMonth(m.month), count: m.count, sumEur: m.sumEur }))
    : [];

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
            <KpiCard label="Belege gesamt" value={String(data.totalReceipts)} />
            <KpiCard label="Summe EUR" value={fmtEur(data.totalAmountEur)} />
            <KpiCard label="Versandfehler" value={String(data.failedSends)} danger={data.failedSends > 0} />
            <KpiCard label="Fremdwaehrungsbelege" value={String(data.foreignCurrencyReceipts)} />
          </div>

          {/* Problem overview */}
          {data.problems.total > 0 ? (
            <Card className="border-danger/30 bg-danger/5">
              <h3 className="text-sm font-semibold text-danger">
                Offene Belege mit Handlungsbedarf ({data.problems.total} {data.problems.total === 1 ? "Beleg" : "Belege"})
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Noch nicht versendete Belege mit fehlenden oder unvollstaendigen Angaben. Ein Beleg kann mehrere Probleme haben.
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {data.problems.missingFile > 0 ? (
                  <ProblemLink label="Ohne Belegdatei" count={data.problems.missingFile} />
                ) : null}
                {data.problems.missingCountry > 0 ? (
                  <ProblemLink label="Ohne Land" count={data.problems.missingCountry} />
                ) : null}
                {data.problems.missingSupplier > 0 ? (
                  <ProblemLink label="Ohne Lieferant" count={data.problems.missingSupplier} />
                ) : null}
                {data.problems.missingExchangeRate > 0 ? (
                  <ProblemLink label="Fehlender Wechselkurs" count={data.problems.missingExchangeRate} />
                ) : null}
                {data.problems.sendFailed > 0 ? (
                  <ProblemLink label="Versand fehlgeschlagen" count={data.problems.sendFailed} href="/receipts?sendStatus=FAILED" />
                ) : null}
                {data.problems.missingHospitality > 0 ? (
                  <ProblemLink label="Bewirtungsangaben fehlen" count={data.problems.missingHospitality} />
                ) : null}
              </div>
            </Card>
          ) : (
            <Card className="border-primary/20 bg-primary/5">
              <p className="text-sm font-medium text-primary">Keine offenen Belege mit Handlungsbedarf.</p>
            </Card>
          )}

          <Card className="space-y-4 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold">Zeit-Auswertung</h3>
                <p className="text-xs text-muted-foreground">Summiert nach der gewaelten Periode.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <PeriodModeButton active={periodMode === "day"} onClick={() => setPeriodMode("day")} label="Tag" />
                <PeriodModeButton active={periodMode === "week"} onClick={() => setPeriodMode("week")} label="Woche" />
                <PeriodModeButton active={periodMode === "month"} onClick={() => setPeriodMode("month")} label="Monat" />
              </div>
            </div>
            <PeriodTable
              title={periodMode === "day" ? "Nach Tag" : periodMode === "week" ? "Nach Woche" : "Nach Monat"}
              label={periodMode === "day" ? "Tag" : periodMode === "week" ? "Woche" : "Monat"}
              rows={periodRows}
            />
          </Card>

          {/* Status tables */}
          <div className="grid gap-6 lg:grid-cols-2">
            <GroupTable title="Versandstatus" rows={data.byStatus.map((s) => ({ name: STATUS_LABELS[s.status] ?? s.status, count: s.count }))} />
            <GroupTable title="Pruefstatus" rows={data.byReviewStatus.map((s) => ({ name: REVIEW_LABELS[s.status] ?? s.status, count: s.count }))} />
            <CurrencyTable rows={data.byCurrency} />
            <GroupTable title="Nach Benutzer" rows={data.byUser.map((u) => ({ name: u.userName, count: u.count, sumEur: u.sumEur }))} showSum />
            <GroupTable title="Nach Zweck" rows={data.byPurpose.map((p) => ({ name: p.name, count: p.count, sumEur: p.sumEur }))} showSum />
            <GroupTable title="Nach Zahlungsweise" rows={data.byPaymentMethod.map((c) => ({ name: c.name, count: c.count, sumEur: c.sumEur }))} showSum />
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

function ProblemLink({ label, count, href }: { label: string; count: number; href?: string }) {
  const content = (
    <div className="flex items-center justify-between rounded-xl border border-danger/20 bg-background px-3 py-2 text-sm">
      <span>{label}</span>
      <span className="ml-2 rounded-full bg-danger/10 px-2.5 py-0.5 text-xs font-semibold tabular-nums text-danger">{count}</span>
    </div>
  );
  if (href) return <a href={href} className="hover:opacity-80 transition">{content}</a>;
  return content;
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

function PeriodTable({
  title,
  label,
  rows,
}: {
  title: string;
  label: string;
  rows: { key: string; label: string; count: number; sumEur: number }[];
}) {
  const totalCount = rows.reduce((sum, row) => sum + row.count, 0);
  const totalSumEur = rows.reduce((sum, row) => sum + row.sumEur, 0);

  return (
    <Card className="overflow-hidden p-0">
      <div className="border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-muted-foreground">
            <th className="px-4 py-2 font-medium">{label}</th>
            <th className="px-4 py-2 font-medium text-right">Anzahl</th>
            <th className="px-4 py-2 font-medium text-right">Summe EUR</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={3} className="px-4 py-3 text-muted-foreground">Keine Daten</td></tr>
          ) : rows.map((row) => (
            <tr key={row.key} className="border-b border-border/50">
              <td className="px-4 py-2">{row.label}</td>
              <td className="px-4 py-2 text-right tabular-nums">{row.count}</td>
              <td className="px-4 py-2 text-right tabular-nums">{fmtEur(row.sumEur)}</td>
            </tr>
          ))}
        </tbody>
        {rows.length > 0 ? (
          <tfoot>
            <tr className="border-t-2 border-border bg-muted/20 font-semibold">
              <td className="px-4 py-2">Gesamtsumme</td>
              <td className="px-4 py-2 text-right tabular-nums">{totalCount}</td>
              <td className="px-4 py-2 text-right tabular-nums">{fmtEur(totalSumEur)}</td>
            </tr>
          </tfoot>
        ) : null}
      </table>
    </Card>
  );
}

function PeriodModeButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border px-3 py-1.5 text-sm font-medium transition ${
        active
          ? "border-primary/40 bg-primary/10 text-primary"
          : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-primary"
      }`}
    >
      {label}
    </button>
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
