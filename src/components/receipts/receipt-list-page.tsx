"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ReceiptFilterBar } from "@/components/receipts/receipt-filter-bar";
import { NewReceiptLink } from "@/components/receipts/new-receipt-link";
import { getReviewStatusBadgeClass, getReviewStatusLabel } from "@/lib/receipts/review-status";
import { datevBelegtypLabel, type DatevBelegtyp } from "@/lib/datev/belegtyp";

// ============================================================
// Types
// ============================================================

type ReceiptRow = {
  id: string;
  date: string;
  partyRole: "CREDITOR" | "DEBTOR";
  supplier: string | null;
  amount: number;
  currency: string;
  amountEur: number;
  sendStatus: string;
  reviewStatus: string;
  sendStatusUpdatedAt: string | null;
  userName: string;
  purposeName: string;
  isHospitality: boolean;
  hasHospitality: boolean;
  datevBelegtyp: DatevBelegtyp | null;
  countryName: string | null;
  vehiclePlate: string | null;
  hasFile: boolean;
  fileId: string | null;
  fileMimeType: string | null;
  createdAt: string;
};

type Pagination = {
  page: number;
  pageSize: number;
  pageSizeParam: string;
  total: number;
  totalPages: number;
};

type Filters = {
  search: string;
  sendStatus: string;
  reviewStatus: string;
  purposeId: string;
  datevBelegtyp: string;
  countryId: string;
  vehicleId: string;
  userId: string;
  dateFrom: string;
  dateTo: string;
  sortBy: string;
  sortDir: string;
};

type FilterOptions = {
  purposes: { id: string; name: string }[];
  countries: { id: string; label: string }[];
  vehicles: { id: string; label: string }[];
  users: { id: string; label: string }[];
};

type Props = {
  receipts: ReceiptRow[];
  pagination: Pagination;
  filters: Filters;
  filterOptions: FilterOptions;
  isAdmin: boolean;
};

// ============================================================
// Helpers
// ============================================================

const STATUS_COLORS: Record<string, string> = {
  OPEN: "bg-muted text-muted-foreground",
  READY: "bg-accent/20 text-accent-foreground",
  SENT: "bg-primary/10 text-primary",
  FAILED: "bg-danger/10 text-danger",
  RETRY: "bg-accent/20 text-accent-foreground",
};

const STATUS_LABELS: Record<string, string> = {
  OPEN: "offen",
  READY: "bereit",
  SENT: "gesendet",
  FAILED: "fehlgeschlagen",
  RETRY: "erneut",
};

type ColumnKey =
  | "date"
  | "supplier"
  | "amount"
  | "purpose"
  | "datevBelegtyp"
  | "country"
  | "user"
  | "reviewStatus"
  | "sendStatus"
  | "sentAt";

const DEFAULT_VISIBLE_COLUMNS: ColumnKey[] = [
  "date",
  "supplier",
  "amount",
  "purpose",
  "datevBelegtyp",
  "country",
  "user",
  "reviewStatus",
  "sendStatus",
  "sentAt",
];

const COLUMN_OPTIONS: { key: ColumnKey; label: string }[] = [
  { key: "date", label: "Datum" },
  { key: "supplier", label: "Lieferant" },
  { key: "amount", label: "Betrag" },
  { key: "purpose", label: "Zweck" },
  { key: "datevBelegtyp", label: "DATEV-Belegtyp" },
  { key: "country", label: "Land" },
  { key: "user", label: "Benutzer" },
  { key: "reviewStatus", label: "Pruefung" },
  { key: "sendStatus", label: "Versand" },
  { key: "sentAt", label: "Gesendet" },
];

const SORT_OPTIONS = [
  { value: "date", label: "Datum" },
  { value: "supplier", label: "Lieferant" },
  { value: "amount", label: "Betrag" },
  { value: "amountEur", label: "Betrag EUR" },
  { value: "purpose", label: "Zweck" },
  { value: "datevBelegtyp", label: "DATEV-Belegtyp" },
  { value: "country", label: "Land" },
  { value: "user", label: "Benutzer" },
  { value: "reviewStatus", label: "Pruefung" },
  { value: "sendStatus", label: "Versand" },
  { value: "createdAt", label: "Erfasst am" },
];

const COLUMN_STORAGE_KEY = "receipt-list-visible-columns";

const COLUMN_SORT_MAP: Partial<Record<ColumnKey, string>> = {
  date: "date",
  supplier: "supplier",
  amount: "amount",
  purpose: "purpose",
  datevBelegtyp: "datevBelegtyp",
  country: "country",
  user: "user",
  reviewStatus: "reviewStatus",
  sendStatus: "sendStatus",
  sentAt: "date",
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function fmtAmount(n: number) {
  return n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function receiptRowToneClass(sendStatus: string) {
  if (sendStatus === "SENT") return "receipt-row--sent";
  if (sendStatus === "FAILED" || sendStatus === "RETRY") return "receipt-row--failed";
  return "receipt-row--pending";
}

// ============================================================
// Main component
// ============================================================

export function ReceiptListPage({ receipts, pagination, filters, filterOptions, isAdmin }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [visibleColumns, setVisibleColumns] = useState<ColumnKey[]>(DEFAULT_VISIBLE_COLUMNS);
  const [columnMenuOpen, setColumnMenuOpen] = useState(false);

  const setParams = useCallback((updates: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, val] of Object.entries(updates)) {
      if (val) {
        params.set(key, val);
      } else {
        params.delete(key);
      }
    }
    // Reset to page 1 when filters change (unless page itself is being set)
    if (!("page" in updates)) {
      params.delete("page");
    }
    router.push(`/receipts?${params.toString()}`);
  }, [router, searchParams]);

  const hasActiveFilters = !!(filters.search || filters.sendStatus || filters.reviewStatus || filters.purposeId || filters.datevBelegtyp || filters.countryId || filters.vehicleId || filters.userId || filters.dateFrom || filters.dateTo);

  useEffect(() => {
    const saved = window.localStorage.getItem(COLUMN_STORAGE_KEY);
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        const next = parsed.filter((value): value is ColumnKey => COLUMN_OPTIONS.some((column) => column.key === value));
        if (next.length > 0) {
          setVisibleColumns(next);
        }
      }
    } catch {
      // Ignore invalid saved preferences.
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(COLUMN_STORAGE_KEY, JSON.stringify(visibleColumns));
  }, [visibleColumns]);

  const toggleColumn = useCallback((columnKey: ColumnKey) => {
    setVisibleColumns((current) => {
      if (current.includes(columnKey)) {
        return current.length > 1 ? current.filter((key) => key !== columnKey) : current;
      }
      return [...current, columnKey];
    });
  }, []);

  const setColumnAt = useCallback((index: number, nextKey: ColumnKey) => {
    setVisibleColumns((current) => {
      const existingIndex = current.indexOf(nextKey);
      const next = [...current];
      if (existingIndex >= 0 && existingIndex !== index) {
        next[existingIndex] = current[index];
      }
      next[index] = nextKey;
      return next;
    });
  }, []);

  const resetColumns = useCallback(() => {
    setVisibleColumns(DEFAULT_VISIBLE_COLUMNS);
  }, []);

  const isColumnVisible = useCallback((columnKey: ColumnKey) => visibleColumns.includes(columnKey), [visibleColumns]);

  const handleSortClick = useCallback((sortBy: string) => {
    const nextDir = filters.sortBy === sortBy && filters.sortDir === "asc" ? "desc" : "asc";
    setParams({ sortBy, sortDir: nextDir });
  }, [filters.sortBy, filters.sortDir, setParams]);

  const openReceipt = useCallback((id: string) => {
    router.push(`/receipts/${id}`);
  }, [router]);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <ReceiptFilterBar
        filters={filters}
        filterOptions={filterOptions}
        isAdmin={isAdmin}
        onFilterChange={setParams}
        eyebrow="Belegliste"
        title="Belege verwalten"
        subtitle={`${pagination.total} ${pagination.total === 1 ? "Beleg" : "Belege"}${hasActiveFilters ? " (gefiltert)" : ""}`}
        exportHref={`/api/receipts/export?${searchParams.toString()}`}
        footerContent={(
          <>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Sortieren</span>
              <select
                value={filters.sortBy}
                onChange={(e) => setParams({ sortBy: e.target.value })}
                className="bb-select input-3d h-9 rounded-xl px-3 text-sm text-foreground outline-none transition-all duration-200 focus:ring-2 focus:ring-primary/20"
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Richtung</span>
              <select
                value={filters.sortDir}
                onChange={(e) => setParams({ sortDir: e.target.value })}
                className="bb-select input-3d h-9 rounded-xl px-3 text-sm text-foreground outline-none transition-all duration-200 focus:ring-2 focus:ring-primary/20"
              >
                <option value="desc">absteigend</option>
                <option value="asc">aufsteigend</option>
              </select>
            </label>
            <div className="relative">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setColumnMenuOpen((current) => !current)}
                className={columnMenuOpen ? "border-primary/40 bg-primary/5 text-primary" : "text-muted-foreground"}
              >
                Spalten
              </Button>
              {columnMenuOpen ? (
                <div className="absolute right-0 z-10 mt-2 w-64 rounded-2xl border border-border bg-popover p-3 shadow-soft">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-foreground">Spalten anzeigen</p>
                    <button
                      type="button"
                      onClick={resetColumns}
                      className="rounded-lg border border-border/60 px-2 py-0.5 text-xs font-medium text-muted-foreground transition hover:border-primary/40 hover:text-primary"
                    >
                      Standard
                    </button>
                  </div>
                  <div className="space-y-2">
                    {COLUMN_OPTIONS.map((column) => (
                      <label key={column.key} className="flex items-center gap-2 rounded-xl px-1 py-1 text-sm text-foreground hover:bg-muted/50">
                        <input
                          type="checkbox"
                          checked={isColumnVisible(column.key)}
                          onChange={() => toggleColumn(column.key)}
                          className="h-4 w-4 rounded border-border"
                        />
                        <span>{column.label}</span>
                      </label>
                    ))}
                  </div>
                  <div className="mt-3 flex justify-end">
                    <Button variant="secondary" size="sm" onClick={() => setColumnMenuOpen(false)}>
                      Schliessen
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          </>
        )}
      />

      {/* Results */}
      {receipts.length === 0 ? (
        <Card className="flex flex-col items-start gap-4">
          <div className="space-y-2">
            <h2 className="text-xl font-semibold tracking-tight">
              {hasActiveFilters ? "Keine Treffer" : "Noch keine Belege"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {hasActiveFilters
                ? "Versuchen Sie andere Filterkriterien oder setzen Sie die Filter zurueck."
                : "Erfassen Sie Ihren ersten Beleg per Upload oder Kamera."}
            </p>
          </div>
          {hasActiveFilters ? (
            <Button variant="secondary" size="lg" onClick={() => router.push("/receipts")}>
              Filter zuruecksetzen
            </Button>
          ) : (
            <NewReceiptLink className="inline-flex items-center justify-center rounded-2xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90">
              Neuen Beleg anlegen
            </NewReceiptLink>
          )}
        </Card>
      ) : (
        <>
          <ListToolbar
            pagination={pagination}
            onPageChange={(nextPage) => setParams({ page: String(nextPage) })}
            onPageSizeChange={(nextSize) => setParams({ pageSize: nextSize, page: "1" })}
          />

          {/* Mobile: eine kompakte Zeile pro Beleg */}
          <div className="space-y-1.5 lg:hidden">
            {receipts.map((r) => (
              <Link
                key={r.id}
                href={`/receipts/${r.id}`}
                className={`bb-card receipt-row flex items-center gap-2 rounded-xl border border-border/80 px-3 py-1.5 text-card-foreground shadow-soft transition ${receiptRowToneClass(r.sendStatus)}`}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {r.supplier ?? "Beleg"}
                  </p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {fmtDate(r.date)} · {fmtAmount(r.amount)} {r.currency}
                    {!r.hasFile ? " · Datei fehlt" : ""}
                    {r.sendStatus === "FAILED" ? " · Fehler" : ""}
                  </p>
                </div>
                <StatusBadge status={r.sendStatus} />
              </Link>
            ))}
          </div>

          {/* Desktop table */}
          <Card className="hidden overflow-x-auto !p-0 lg:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  {visibleColumns.map((columnKey, index) => (
                    <ColumnHeader
                      key={`${columnKey}-${index}`}
                      columnKey={columnKey}
                      index={index}
                      activeSortBy={filters.sortBy}
                      activeSortDir={filters.sortDir}
                      onSort={handleSortClick}
                      onFieldChange={setColumnAt}
                    />
                  ))}
                </tr>
              </thead>
              <tbody>
                {receipts.map((r) => (
                  <tr
                    key={r.id}
                    role="link"
                    tabIndex={0}
                    onClick={() => openReceipt(r.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        openReceipt(r.id);
                      }
                    }}
                    className={`cursor-pointer border-b border-border/50 transition ${receiptRowToneClass(r.sendStatus)}`}
                  >
                    {visibleColumns.map((columnKey, index) => (
                      <td key={`${r.id}-${columnKey}-${index}`} className="px-4 py-1">
                        <ColumnCell receipt={r} columnKey={columnKey} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </div>
  );
}

// ============================================================
// Sub-components
// ============================================================

const PAGE_SIZE_OPTIONS = [
  { value: "25", label: "25" },
  { value: "50", label: "50" },
  { value: "75", label: "75" },
  { value: "100", label: "100" },
  { value: "all", label: "Alle" },
] as const;

function ListToolbar({
  pagination,
  onPageChange,
  onPageSizeChange,
}: {
  pagination: Pagination;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: string) => void;
}) {
  const canPage = pagination.pageSizeParam !== "all" && pagination.totalPages > 1;

  return (
    <div className="bb-card flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/80 bg-card px-3 py-2 shadow-soft">
      <p className="text-sm font-medium text-foreground">
        {pagination.total} {pagination.total === 1 ? "Beleg" : "Belege"} gesamt
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Pro Seite</span>
          <select
            value={pagination.pageSizeParam}
            onChange={(event) => onPageSizeChange(event.target.value)}
            className="bb-select input-3d h-8 rounded-xl px-2 text-sm text-foreground outline-none"
          >
            {PAGE_SIZE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={!canPage || pagination.page <= 1}
            onClick={() => onPageChange(pagination.page - 1)}
            className="bb-chip-button inline-flex h-8 w-8 items-center justify-center rounded-xl text-sm disabled:opacity-40"
            aria-label="Vorherige Seite"
            title="Vorherige Seite"
          >
            ←
          </button>
          <p className="min-w-[7rem] text-center text-sm text-muted-foreground">
            {pagination.pageSizeParam === "all"
              ? "Alle Belege"
              : `Seite ${pagination.page} / ${pagination.totalPages}`}
          </p>
          <button
            type="button"
            disabled={!canPage || pagination.page >= pagination.totalPages}
            onClick={() => onPageChange(pagination.page + 1)}
            className="bb-chip-button inline-flex h-8 w-8 items-center justify-center rounded-xl text-sm disabled:opacity-40"
            aria-label="Naechste Seite"
            title="Naechste Seite"
          >
            →
          </button>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_COLORS[status] ?? ""}`}>
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

function ReviewBadge({ status }: { status: string }) {
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${getReviewStatusBadgeClass(status)}`}>
      {getReviewStatusLabel(status)}
    </span>
  );
}

function ColumnHeader({
  columnKey,
  index,
  activeSortBy,
  activeSortDir,
  onSort,
  onFieldChange,
}: {
  columnKey: ColumnKey;
  index: number;
  activeSortBy: string;
  activeSortDir: string;
  onSort: (sortBy: string) => void;
  onFieldChange: (index: number, nextKey: ColumnKey) => void;
}) {
  const mappedSortBy = COLUMN_SORT_MAP[columnKey];
  const active = mappedSortBy === activeSortBy;
  const directionIcon = active ? (activeSortDir === "asc" ? "▲" : "▼") : "↕";

  return (
    <th className="px-2 py-1 font-medium">
      <div className="flex min-w-[8.5rem] items-center gap-1">
        <select
          value={columnKey}
          onClick={(event) => event.stopPropagation()}
          onChange={(event) => {
            event.stopPropagation();
            onFieldChange(index, event.target.value as ColumnKey);
          }}
          className="bb-select input-3d h-8 min-w-0 flex-1 rounded-lg px-2 text-xs text-foreground outline-none"
          aria-label={`Feld fuer Spalte ${index + 1}`}
        >
          {COLUMN_OPTIONS.map((option) => (
            <option key={option.key} value={option.key}>
              {option.label}
            </option>
          ))}
        </select>
        {mappedSortBy ? (
          <button
            type="button"
            onClick={() => onSort(mappedSortBy)}
            className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[10px] transition hover:bg-muted/60 ${active ? "text-foreground" : "text-muted-foreground"}`}
            title="Sortieren"
            aria-label="Sortieren"
          >
            {directionIcon}
          </button>
        ) : null}
      </div>
    </th>
  );
}

function ColumnCell({ receipt, columnKey }: { receipt: ReceiptRow; columnKey: ColumnKey }) {
  switch (columnKey) {
    case "date":
      return <span className="whitespace-nowrap">{fmtDate(receipt.date)}</span>;
    case "supplier":
      return (
        <span className="inline-flex max-w-[160px] items-center truncate">
          <span className="mr-1 rounded bg-muted px-1 py-0.5 text-[10px] font-semibold text-muted-foreground">
            {receipt.partyRole === "DEBTOR" ? "D" : "K"}
          </span>
          {receipt.supplier ?? "—"}
          {receipt.hasHospitality ? (
            <span className="ml-1 rounded bg-accent/20 px-1 py-0.5 text-[10px] font-semibold text-accent-foreground">B</span>
          ) : null}
        </span>
      );
    case "amount":
      return (
        <span className="whitespace-nowrap tabular-nums">
          {fmtAmount(receipt.amount)} {receipt.currency}
          {receipt.currency !== "EUR" ? (
            <span className="ml-1 text-xs text-muted-foreground">({fmtAmount(receipt.amountEur)} EUR)</span>
          ) : null}
        </span>
      );
    case "purpose":
      return <>{receipt.purposeName}</>;
    case "datevBelegtyp":
      return <span className="whitespace-nowrap">{datevBelegtypLabel(receipt.datevBelegtyp) ?? "—"}</span>;
    case "country":
      return <span className="text-muted-foreground">{receipt.countryName ?? "—"}</span>;
    case "user":
      return <span className="text-muted-foreground">{receipt.userName}</span>;
    case "reviewStatus":
      return <ReviewBadge status={receipt.reviewStatus} />;
    case "sendStatus":
      return <StatusBadge status={receipt.sendStatus} />;
    case "sentAt":
      return (
        <span className="whitespace-nowrap text-xs text-muted-foreground">
          {receipt.sendStatus === "SENT" && receipt.sendStatusUpdatedAt ? fmtDateTime(receipt.sendStatusUpdatedAt) : "—"}
        </span>
      );
    default:
      return null;
  }
}
