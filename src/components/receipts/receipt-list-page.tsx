"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <p className="text-sm font-medium uppercase tracking-[0.24em] text-muted-foreground">
            Belegliste
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">Belege verwalten</h1>
          <p className="text-sm text-muted-foreground">
            {pagination.total} {pagination.total === 1 ? "Beleg" : "Belege"}
            {hasActiveFilters ? " (gefiltert)" : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isAdmin ? (
            <a
              href={`/api/receipts/export?${searchParams.toString()}`}
              className="rounded-2xl border border-border bg-card px-4 py-3 text-sm font-semibold transition hover:border-primary/40 hover:text-primary"
            >
              CSV-Export
            </a>
          ) : null}
          <Link
            href="/receipts/new"
            className="rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
          >
            Neuer Beleg
          </Link>
        </div>
      </div>

      {/* Filters */}
      <ReceiptFilterBar
        filters={filters}
        filterOptions={filterOptions}
        isAdmin={isAdmin}
        onFilterChange={setParams}
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
              <Link key={r.id} href={`/receipts/${r.id}`}>
                <Card className="space-y-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{r.supplier ?? "Beleg"}</p>
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
                  </div>
                </Card>
              </Link>
            ))}
          </div>

          {/* Desktop table */}
          <Card className="hidden overflow-x-auto p-0 lg:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Datum</th>
                  <th className="px-4 py-3 font-medium">Lieferant</th>
                  <th className="px-4 py-3 font-medium">Betrag</th>
                  <th className="px-4 py-3 font-medium">Zweck</th>
                  <th className="px-4 py-3 font-medium">Kategorie</th>
                  <th className="px-4 py-3 font-medium">Land</th>
                  <th className="px-4 py-3 font-medium">Benutzer</th>
                  <th className="px-4 py-3 font-medium">Pruefung</th>
                  <th className="px-4 py-3 font-medium">Versand</th>
                  <th className="px-4 py-3 font-medium">Gesendet</th>
                </tr>
              </thead>
              <tbody>
                {receipts.map((r) => (
                  <tr key={r.id} className="border-b border-border/50 transition hover:bg-muted/30">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Link href={`/receipts/${r.id}`} className="hover:text-primary hover:underline">
                        {fmtDate(r.date)}
                      </Link>
                    </td>
                    <td className="px-4 py-3 max-w-[160px] truncate">
                      {r.supplier ?? "—"}
                      {r.hasHospitality ? <span className="ml-1 rounded bg-accent/20 px-1 py-0.5 text-[10px] font-semibold text-accent-foreground">B</span> : null}
                    </td>
                    <td className="px-4 py-3 tabular-nums whitespace-nowrap">
                      {fmtAmount(r.amount)} {r.currency}
                      {r.currency !== "EUR" ? (
                        <span className="ml-1 text-xs text-muted-foreground">({fmtAmount(r.amountEur)} EUR)</span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">{r.purposeName}</td>
                    <td className="px-4 py-3">{r.categoryName}</td>
                    <td className="px-4 py-3 text-muted-foreground">{r.countryName ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{r.userName}</td>
                    <td className="px-4 py-3">
                      <ReviewBadge status={r.reviewStatus} />
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={r.sendStatus} />
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {r.sendStatus === "SENT" && r.sendStatusUpdatedAt ? fmtDateTime(r.sendStatusUpdatedAt) : "—"}
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
