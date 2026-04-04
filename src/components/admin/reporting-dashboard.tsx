"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Card } from "@/components/ui/card";

type SummaryData = {
  totalReceipts: number;
  totalAmountEur: number;
  failedSends: number;
  foreignCurrencyReceipts: number;
  byStatus: { status: string; count: number }[];
  byReviewStatus: { status: string; count: number }[];
  byDay: { day: string; weekStart: string; count: number; sumEur: number }[];
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

function findWeekStartForDay(day: string, days: Array<{ day: string; weekStart: string }>) {
  return days.find((entry) => entry.day === day)?.weekStart ?? "";
}

function resolveMonthFromWeek(weekStart: string, weekDays: Array<{ day: string }>, monthRows: Array<{ month: string }>) {
  const inferred = weekDays[weekDays.length - 1]?.day.slice(0, 7) ?? weekStart.slice(0, 7);
  return monthRows.some((row) => row.month === inferred)
    ? inferred
    : monthRows[monthRows.length - 1]?.month ?? "";
}

function fmtPrintTimestamp() {
  return new Date().toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ReportingDashboard() {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [data, setData] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState("");
  const [selectedWeek, setSelectedWeek] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [activePeriod, setActivePeriod] = useState<PeriodMode>("month");
  const [printTimestamp, setPrintTimestamp] = useState("");

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
  useEffect(() => {
    const updateTimestamp = () => setPrintTimestamp(fmtPrintTimestamp());
    updateTimestamp();
    window.addEventListener("beforeprint", updateTimestamp);
    return () => window.removeEventListener("beforeprint", updateTimestamp);
  }, []);
  const dayRows = data?.byDay ?? [];
  const weekRows = data?.byWeek ?? [];
  const monthRows = data?.byMonth ?? [];

  const monthDayRows = useMemo(
    () => (selectedMonth ? dayRows.filter((row) => row.day.startsWith(`${selectedMonth}-`)) : dayRows),
    [dayRows, selectedMonth],
  );
  const monthWeekRows = useMemo(() => {
    const weekStarts = new Set(monthDayRows.map((row) => row.weekStart));
    return weekRows.filter((week) => weekStarts.has(week.weekStart));
  }, [monthDayRows, weekRows]);
  const weekDayRows = useMemo(
    () => (selectedWeek ? dayRows.filter((row) => row.weekStart === selectedWeek) : []),
    [dayRows, selectedWeek],
  );
  const visibleDayRows = selectedMonth ? monthDayRows : weekDayRows;

  const selectedDaySummary = dayRows.find((row) => row.day === selectedDay) ?? null;
  const selectedWeekSummary = weekRows.find((row) => row.weekStart === selectedWeek) ?? null;
  const selectedMonthSummary = monthRows.find((row) => row.month === selectedMonth) ?? null;

  const handleMonthChange = useCallback((value: string) => {
    setActivePeriod("month");
    setSelectedMonth(value);
    const nextMonthDays = dayRows.filter((row) => row.day.startsWith(`${value}-`));
    const weekStarts = new Set(nextMonthDays.map((row) => row.weekStart));
    const nextMonthWeeks = weekRows.filter((week) => weekStarts.has(week.weekStart));
    setSelectedWeek(nextMonthWeeks[nextMonthWeeks.length - 1]?.weekStart ?? "");
    setSelectedDay(nextMonthDays[nextMonthDays.length - 1]?.day ?? "");
  }, [dayRows, weekRows]);

  const handleWeekChange = useCallback((value: string) => {
    setActivePeriod("week");
    setSelectedWeek(value);
    const nextWeekDays = dayRows.filter((row) => row.weekStart === value);
    setSelectedDay(nextWeekDays[nextWeekDays.length - 1]?.day ?? "");
    setSelectedMonth(resolveMonthFromWeek(value, nextWeekDays, monthRows));
  }, [dayRows, monthRows]);

  const handleDayChange = useCallback((value: string) => {
    setActivePeriod("day");
    setSelectedDay(value);
    setSelectedWeek(findWeekStartForDay(value, dayRows));
    setSelectedMonth(value.slice(0, 7));
  }, [dayRows]);

  useEffect(() => {
    if (!data || monthRows.length === 0 || selectedMonth) return;
    handleMonthChange(monthRows[monthRows.length - 1].month);
  }, [data, handleMonthChange, monthRows, selectedMonth]);

  useEffect(() => {
    if (!data || monthRows.length === 0) return;

    if (!selectedMonth || !monthRows.some((row) => row.month === selectedMonth)) {
      handleMonthChange(monthRows[monthRows.length - 1].month);
      return;
    }

    if (activePeriod !== "month" && (!selectedWeek || !weekRows.some((row) => row.weekStart === selectedWeek))) {
      const fallbackWeek = monthWeekRows[monthWeekRows.length - 1]?.weekStart ?? weekRows[weekRows.length - 1]?.weekStart;
      if (fallbackWeek) handleWeekChange(fallbackWeek);
      return;
    }

    if (activePeriod === "day" && (!selectedDay || !dayRows.some((row) => row.day === selectedDay))) {
      const fallbackDay = weekDayRows[weekDayRows.length - 1]?.day ?? dayRows[dayRows.length - 1]?.day;
      if (fallbackDay) handleDayChange(fallbackDay);
    }
  }, [
    activePeriod,
    data,
    dayRows,
    handleDayChange,
    handleMonthChange,
    handleWeekChange,
    monthRows,
    monthWeekRows,
    selectedDay,
    selectedMonth,
    selectedWeek,
    weekDayRows,
    weekRows,
  ]);

  const printDayRows = activePeriod === "month"
    ? monthDayRows
    : activePeriod === "week"
      ? weekDayRows
      : selectedDaySummary ? [selectedDaySummary] : [];
  const printWeekRows = activePeriod === "month"
    ? monthWeekRows
    : activePeriod === "week"
      ? (selectedWeekSummary ? [selectedWeekSummary] : [])
      : [];
  const printMonthRows = activePeriod === "month" && selectedMonthSummary ? [selectedMonthSummary] : [];
  const printScopeLabel = activePeriod === "day"
    ? `Tag: ${selectedDay ? fmtDay(selectedDay) : "-"}`
    : activePeriod === "week"
      ? `Woche: ${selectedWeekSummary?.weekLabel ?? "-"}`
      : `Monat: ${selectedMonth ? fmtMonth(selectedMonth) : "-"}`;
  const printRangeLabel = [
    dateFrom ? `von ${fmtDay(dateFrom)}` : "",
    dateTo ? `bis ${fmtDay(dateTo)}` : "",
  ].filter(Boolean).join(" ");

  return (
    <div className="space-y-8">
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 14mm; }
          .report-screen-only { display: none !important; }
          .report-print-only { display: block !important; }
          .report-print-section { break-inside: avoid; page-break-inside: avoid; }
          body { background: white !important; color: black !important; }
        }
        @media screen {
          .report-print-only { display: none !important; }
        }
      `}</style>
      <div className="report-screen-only space-y-2">
        <p className="text-sm font-medium uppercase tracking-[0.24em] text-muted-foreground">Auswertung</p>
        <h1 className="text-3xl font-semibold tracking-tight">Reporting</h1>
      </div>

      {/* Date filter */}
      <Card className="report-screen-only flex flex-wrap items-end gap-4 p-4">
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
        <button type="button" onClick={() => window.print()} className="h-9 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:opacity-90">
          Drucken
        </button>
      </Card>

      {loading ? (
        <p className="text-sm text-muted-foreground">Daten werden geladen...</p>
      ) : data ? (
        <>
          {/* KPIs */}
          <div className="report-screen-only grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard label="Belege gesamt" value={String(data.totalReceipts)} />
            <KpiCard label="Summe EUR" value={fmtEur(data.totalAmountEur)} />
            <KpiCard label="Versandfehler" value={String(data.failedSends)} danger={data.failedSends > 0} />
            <KpiCard label="Fremdwaehrungsbelege" value={String(data.foreignCurrencyReceipts)} />
          </div>

          {/* Problem overview */}
          {data.problems.total > 0 ? (
            <Card className="report-screen-only border-danger/30 bg-danger/5">
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
            <Card className="report-screen-only border-primary/20 bg-primary/5">
              <p className="text-sm font-medium text-primary">Keine offenen Belege mit Handlungsbedarf.</p>
            </Card>
          )}

          <div className="report-screen-only grid gap-6 xl:grid-cols-3">
            <PeriodSelectorCard
              title="Nach Tag"
              label="Tag"
              value={selectedDay}
              onChange={handleDayChange}
              options={visibleDayRows.map((row) => ({ value: row.day, label: fmtDay(row.day) }))}
              summary={selectedDaySummary}
              rows={visibleDayRows.map((row) => ({ key: row.day, label: fmtDay(row.day), count: row.count, sumEur: row.sumEur }))}
              listTitle={selectedMonth ? "Tage im gewaehlten Monat" : "Tage in der gewaehlten Woche"}
            />
            <PeriodSelectorCard
              title="Nach Woche"
              label="Woche"
              value={selectedWeek}
              onChange={handleWeekChange}
              options={monthWeekRows.map((row) => ({ value: row.weekStart, label: row.weekLabel }))}
              summary={selectedWeekSummary}
              rows={monthWeekRows.map((row) => ({ key: row.weekStart, label: row.weekLabel, count: row.count, sumEur: row.sumEur }))}
              listTitle="Wochen im gewaehlten Monat"
            />
            <PeriodSelectorCard
              title="Nach Monat"
              label="Monat"
              value={selectedMonth}
              onChange={handleMonthChange}
              options={monthRows.map((row) => ({ value: row.month, label: fmtMonth(row.month) }))}
              summary={selectedMonthSummary}
            />
          </div>

          <div className="report-print-only space-y-6">
            <div className="report-print-section border-b border-slate-300 pb-4">
              <div className="flex items-start justify-between gap-6">
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Auswertung</p>
                  <h1 className="text-2xl font-semibold text-black">Druckansicht Reporting</h1>
                </div>
                <p className="text-xs text-slate-500">Erstellt am {printTimestamp}</p>
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-3">
                <div className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2">
                  <p className="text-[11px] uppercase tracking-wide text-slate-500">Auswahl</p>
                  <p className="text-sm font-medium">{printScopeLabel}</p>
                </div>
                <div className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2">
                  <p className="text-[11px] uppercase tracking-wide text-slate-500">Monat</p>
                  <p className="text-sm font-medium">{selectedMonth ? fmtMonth(selectedMonth) : "-"}</p>
                </div>
                <div className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2">
                  <p className="text-[11px] uppercase tracking-wide text-slate-500">Zeitraumfilter</p>
                  <p className="text-sm font-medium">{printRangeLabel || "Kein zusaetzlicher Filter"}</p>
                </div>
              </div>
            </div>
            <PrintSummarySection
              title={activePeriod === "day" ? "Gewaehlter Tag" : activePeriod === "week" ? "Tage der gewaelten Woche" : "Tage des gewaehlten Monats"}
              label="Tag"
              rows={printDayRows.map((row) => ({ key: row.day, label: fmtDay(row.day), count: row.count, sumEur: row.sumEur }))}
            />
            {printWeekRows.length > 0 ? (
              <PrintSummarySection
                title={activePeriod === "month" ? "Wochen des gewaehlten Monats" : "Gewaehlte Woche"}
                label="Woche"
                rows={printWeekRows.map((row) => ({ key: row.weekStart, label: row.weekLabel, count: row.count, sumEur: row.sumEur }))}
              />
            ) : null}
            {printMonthRows.length > 0 ? (
              <PrintSummarySection
                title="Gewaehlter Monat"
                label="Monat"
                rows={printMonthRows.map((row) => ({ key: row.month, label: fmtMonth(row.month), count: row.count, sumEur: row.sumEur }))}
              />
            ) : null}
          </div>

          {/* Status tables */}
          <div className="report-screen-only grid gap-6 lg:grid-cols-2">
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

function PeriodSelectorCard({
  title,
  label,
  value,
  onChange,
  options,
  summary,
  rows,
  listTitle,
}: {
  title: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  summary: { count: number; sumEur: number } | null;
  rows?: { key: string; label: string; count: number; sumEur: number }[];
  listTitle?: string;
}) {
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

function PrintSummarySection({
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
