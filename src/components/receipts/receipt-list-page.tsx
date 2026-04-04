"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { ReceiptFilterBar } from "@/components/receipts/receipt-filter-bar";
import { getReviewStatusBadgeClass, getReviewStatusLabel } from "@/lib/receipts/review-status";

// ============================================================
// Types
// ============================================================

type ReceiptRow = {
  id: string;
  date: string;
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
  categoryName: string;
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
  total: number;
  totalPages: number;
};

type Filters = {
  search: string;
  sendStatus: string;
  reviewStatus: string;
  purposeId: string;
  categoryId: string;
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
  categories: { id: string; name: string }[];
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
  | "category"
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
  "category",
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
  { key: "category", label: "Kategorie" },
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
  { value: "category", label: "Kategorie" },
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
  category: "category",
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

// ============================================================
// Main component
// ============================================================

export function ReceiptListPage({ receipts, pagination, filters, filterOptions, isAdmin }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [deletingId, setDeletingId] = useState<string | null>(null);
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

  const hasActiveFilters = !!(filters.search || filters.sendStatus || filters.reviewStatus || filters.purposeId || filters.categoryId || filters.countryId || filters.vehicleId || filters.userId || filters.dateFrom || filters.dateTo);

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

  const resetColumns = useCallback(() => {
    setVisibleColumns(DEFAULT_VISIBLE_COLUMNS);
  }, []);

  const isColumnVisible = useCallback((columnKey: ColumnKey) => visibleColumns.includes(columnKey), [visibleColumns]);

  const handleSortClick = useCallback((sortBy: string) => {
    const nextDir = filters.sortBy === sortBy && filters.sortDir === "asc" ? "desc" : "asc";
    setParams({ sortBy, sortDir: nextDir });
  }, [filters.sortBy, filters.sortDir, setParams]);

  const handleDelete = useCallback(async (receiptId: string) => {
    const confirmed = window.confirm("Diesen Beleg wirklich loeschen?");
    if (!confirmed) return;

    setDeletingId(receiptId);
    try {
      const response = await fetch(`/api/receipts/${receiptId}`, { method: "DELETE" });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        const message = data && typeof data === "object" && "error" in data ? String(data.error) : "Beleg konnte nicht geloescht werden.";
        window.alert(message);
        return;
      }
      router.refresh();
    } finally {
      setDeletingId(null);
    }
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
                className="h-9 rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary"
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
                className="h-9 rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary"
              >
                <option value="desc">absteigend</option>
                <option value="asc">aufsteigend</option>
              </select>
            </label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setColumnMenuOpen((current) => !current)}
                className={`flex h-9 items-center rounded-xl border px-3 text-sm font-medium transition ${
                  columnMenuOpen
                    ? "border-primary/40 bg-primary/5 text-primary"
                    : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-primary"
                }`}
              >
                Spalten
              </button>
              {columnMenuOpen ? (
                <div className="absolute right-0 z-10 mt-2 w-64 rounded-2xl border border-border bg-popover p-3 shadow-soft">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-foreground">Spalten anzeigen</p>
                    <button
                      type="button"
                      onClick={resetColumns}
                      className="text-xs font-medium text-muted-foreground transition hover:text-primary"
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
                    <button
                      type="button"
                      onClick={() => setColumnMenuOpen(false)}
                      className="rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:border-primary/40 hover:text-primary"
                    >
                      Schliessen
                    </button>
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
            <button
              type="button"
              onClick={() => router.push("/receipts")}
              className="rounded-2xl border border-border bg-card px-4 py-3 text-sm font-semibold transition hover:border-primary/40 hover:text-primary"
            >
              Filter zuruecksetzen
            </button>
          ) : (
            <Link href="/receipts/new" className="rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90">
              Neuen Beleg anlegen
            </Link>
          )}
        </Card>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="space-y-3 lg:hidden">
            {receipts.map((r) => (
              <Card key={r.id} className="space-y-3 p-4">
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <Link href={`/receipts/${r.id}`} className="truncate font-medium hover:text-primary hover:underline">
                        {r.supplier ?? "Beleg"}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {fmtDate(r.date)} — {r.userName}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <p className="font-semibold tabular-nums text-sm">
                        {fmtAmount(r.amount)} {r.currency}
                      </p>
                      <StatusBadge status={r.sendStatus} />
                      <ReviewBadge status={r.reviewStatus} />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <Tag>{r.purposeName}</Tag>
                    <Tag>{r.categoryName}</Tag>
                    {r.countryName ? <Tag>{r.countryName}</Tag> : null}
                    {r.vehiclePlate ? <Tag>{r.vehiclePlate}</Tag> : null}
                    {r.hasHospitality ? <Tag accent>Bewirtung</Tag> : null}
                    {r.sendStatus === "FAILED" ? <Tag danger>Fehler</Tag> : null}
                    {!r.hasFile ? <Tag danger>Datei fehlt</Tag> : null}
                    {r.sendStatus === "OPEN" && (!r.countryName || !r.supplier) ? <Tag accent>pruefen</Tag> : null}
                    {r.isHospitality && !r.hasHospitality ? <Tag accent>Bewirtung pruefen</Tag> : null}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <ActionLink href={`/receipts/${r.id}`} title="Oeffnen">👁</ActionLink>
                  <ActionLink href={`/receipts/${r.id}/edit`} title="Bearbeiten">✎</ActionLink>
                  <ActionLink href={`/receipts/${r.id}/print`} target="_blank" title="Drucken">🖨</ActionLink>
                  <ActionButton
                    danger
                    disabled={deletingId === r.id}
                    onClick={() => void handleDelete(r.id)}
                    title="Loeschen"
                  >
                    {deletingId === r.id ? "…" : "🗑"}
                  </ActionButton>
                </div>
              </Card>
            ))}
          </div>

          {/* Desktop table */}
          <Card className="hidden overflow-x-auto p-0 lg:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  {isColumnVisible("date") ? <SortableHeader label="Datum" columnKey="date" activeSortBy={filters.sortBy} activeSortDir={filters.sortDir} onClick={handleSortClick} /> : null}
                  {isColumnVisible("supplier") ? <SortableHeader label="Lieferant" columnKey="supplier" activeSortBy={filters.sortBy} activeSortDir={filters.sortDir} onClick={handleSortClick} /> : null}
                  {isColumnVisible("amount") ? <SortableHeader label="Betrag" columnKey="amount" activeSortBy={filters.sortBy} activeSortDir={filters.sortDir} onClick={handleSortClick} /> : null}
                  {isColumnVisible("purpose") ? <SortableHeader label="Zweck" columnKey="purpose" activeSortBy={filters.sortBy} activeSortDir={filters.sortDir} onClick={handleSortClick} /> : null}
                  {isColumnVisible("category") ? <SortableHeader label="Kategorie" columnKey="category" activeSortBy={filters.sortBy} activeSortDir={filters.sortDir} onClick={handleSortClick} /> : null}
                  {isColumnVisible("country") ? <SortableHeader label="Land" columnKey="country" activeSortBy={filters.sortBy} activeSortDir={filters.sortDir} onClick={handleSortClick} /> : null}
                  {isColumnVisible("user") ? <SortableHeader label="Benutzer" columnKey="user" activeSortBy={filters.sortBy} activeSortDir={filters.sortDir} onClick={handleSortClick} /> : null}
                  {isColumnVisible("reviewStatus") ? <SortableHeader label="Pruefung" columnKey="reviewStatus" activeSortBy={filters.sortBy} activeSortDir={filters.sortDir} onClick={handleSortClick} /> : null}
                  {isColumnVisible("sendStatus") ? <SortableHeader label="Versand" columnKey="sendStatus" activeSortBy={filters.sortBy} activeSortDir={filters.sortDir} onClick={handleSortClick} /> : null}
                  {isColumnVisible("sentAt") ? <SortableHeader label="Gesendet" columnKey="sentAt" activeSortBy={filters.sortBy} activeSortDir={filters.sortDir} onClick={handleSortClick} /> : null}
                  <th className="px-4 py-3 font-medium">Aktionen</th>
                </tr>
              </thead>
              <tbody>
                {receipts.map((r) => (
                  <tr key={r.id} className="border-b border-border/50 transition hover:bg-muted/30">
                    {isColumnVisible("date") ? (
                      <td className="px-4 py-3 whitespace-nowrap">
                        <Link href={`/receipts/${r.id}`} className="hover:text-primary hover:underline">
                          {fmtDate(r.date)}
                        </Link>
                      </td>
                    ) : null}
                    {isColumnVisible("supplier") ? (
                      <td className="max-w-[160px] px-4 py-3 truncate">
                        {r.supplier ?? "—"}
                        {r.hasHospitality ? <span className="ml-1 rounded bg-accent/20 px-1 py-0.5 text-[10px] font-semibold text-accent-foreground">B</span> : null}
                      </td>
                    ) : null}
                    {isColumnVisible("amount") ? (
                      <td className="px-4 py-3 tabular-nums whitespace-nowrap">
                        {fmtAmount(r.amount)} {r.currency}
                        {r.currency !== "EUR" ? (
                          <span className="ml-1 text-xs text-muted-foreground">({fmtAmount(r.amountEur)} EUR)</span>
                        ) : null}
                      </td>
                    ) : null}
                    {isColumnVisible("purpose") ? <td className="px-4 py-3">{r.purposeName}</td> : null}
                    {isColumnVisible("category") ? <td className="px-4 py-3">{r.categoryName}</td> : null}
                    {isColumnVisible("country") ? <td className="px-4 py-3 text-muted-foreground">{r.countryName ?? "—"}</td> : null}
                    {isColumnVisible("user") ? <td className="px-4 py-3 text-muted-foreground">{r.userName}</td> : null}
                    {isColumnVisible("reviewStatus") ? (
                      <td className="px-4 py-3">
                        <ReviewBadge status={r.reviewStatus} />
                      </td>
                    ) : null}
                    {isColumnVisible("sendStatus") ? (
                      <td className="px-4 py-3">
                        <StatusBadge status={r.sendStatus} />
                      </td>
                    ) : null}
                    {isColumnVisible("sentAt") ? (
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {r.sendStatus === "SENT" && r.sendStatusUpdatedAt ? fmtDateTime(r.sendStatusUpdatedAt) : "—"}
                      </td>
                    ) : null}
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <ActionLink href={`/receipts/${r.id}`} title="Oeffnen">👁</ActionLink>
                        <ActionLink href={`/receipts/${r.id}/edit`} title="Bearbeiten">✎</ActionLink>
                        <ActionLink href={`/receipts/${r.id}/print`} target="_blank" title="Drucken">🖨</ActionLink>
                        <ActionButton
                          danger
                          disabled={deletingId === r.id}
                          onClick={() => void handleDelete(r.id)}
                          title="Loeschen"
                        >
                          {deletingId === r.id ? "…" : "🗑"}
                        </ActionButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          {/* Pagination */}
          {pagination.totalPages > 1 ? (
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm text-muted-foreground">
                Seite {pagination.page} von {pagination.totalPages}
              </p>
              <div className="flex gap-2">
                <PaginationButton
                  disabled={pagination.page <= 1}
                  onClick={() => setParams({ page: String(pagination.page - 1) })}
                  label="Zurueck"
                />
                <PaginationButton
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => setParams({ page: String(pagination.page + 1) })}
                  label="Weiter"
                />
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

// ============================================================
// Sub-components
// ============================================================

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

function ActionLink({ href, children, target, title }: { href: string; children: React.ReactNode; target?: string; title?: string }) {
  return (
    <a
      href={href}
      target={target}
      title={title}
      aria-label={title}
      className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-border bg-card text-xs font-semibold transition hover:border-primary/40 hover:text-primary"
    >
      {children}
    </a>
  );
}

function ActionButton({
  children,
  onClick,
  disabled,
  danger,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-xl border text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${danger ? "border-danger/30 bg-danger/5 text-danger hover:bg-danger/10" : "border-border bg-card hover:border-primary/40 hover:text-primary"}`}
    >
      {children}
    </button>
  );
}

function Tag({ children, accent, danger }: { children: React.ReactNode; accent?: boolean; danger?: boolean }) {
  let cls = "rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground";
  if (accent) cls = "rounded-full bg-accent/20 px-2 py-0.5 text-[10px] font-semibold text-accent-foreground";
  if (danger) cls = "rounded-full bg-danger/10 px-2 py-0.5 text-[10px] font-semibold text-danger";
  return <span className={cls}>{children}</span>;
}

function PaginationButton({ disabled, onClick, label }: { disabled: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="rounded-2xl border border-border bg-card px-4 py-2 text-sm font-medium transition hover:border-primary/40 hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
    >
      {label}
    </button>
  );
}

function SortableHeader({
  label,
  columnKey,
  activeSortBy,
  activeSortDir,
  onClick,
}: {
  label: string;
  columnKey: ColumnKey;
  activeSortBy: string;
  activeSortDir: string;
  onClick: (sortBy: string) => void;
}) {
  const mappedSortBy = COLUMN_SORT_MAP[columnKey];
  const active = mappedSortBy === activeSortBy;
  const directionIcon = active ? (activeSortDir === "asc" ? "▲" : "▼") : "↕";

  if (!mappedSortBy) {
    return <th className="px-4 py-3 font-medium">{label}</th>;
  }

  return (
    <th className="px-4 py-3 font-medium">
      <button
        type="button"
        onClick={() => onClick(mappedSortBy)}
        className={`inline-flex items-center gap-1 transition hover:text-foreground ${active ? "text-foreground" : ""}`}
      >
        <span>{label}</span>
        <span className="text-[10px]">{directionIcon}</span>
      </button>
    </th>
  );
}
