"use client";

import { useState, type ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { REVIEW_STATUS_OPTIONS } from "@/lib/receipts/review-status";

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
  filters: Filters;
  filterOptions: FilterOptions;
  isAdmin: boolean;
  onFilterChange: (updates: Record<string, string>) => void;
  eyebrow: string;
  title: string;
  subtitle: string;
  exportHref?: string;
  footerContent?: ReactNode;
};

const SEND_STATUSES = [
  { value: "OPEN", label: "offen" },
  { value: "READY", label: "bereit" },
  { value: "SENT", label: "gesendet" },
  { value: "FAILED", label: "fehlgeschlagen" },
  { value: "RETRY", label: "erneut senden" },
];

export function ReceiptFilterBar({
  filters,
  filterOptions,
  isAdmin,
  onFilterChange,
  eyebrow,
  title,
  subtitle,
  exportHref,
  footerContent,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [searchValue, setSearchValue] = useState(filters.search);

  const hasFilters = !!(filters.sendStatus || filters.reviewStatus || filters.purposeId || filters.categoryId || filters.countryId || filters.vehicleId || filters.userId || filters.dateFrom || filters.dateTo);

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    onFilterChange({ search: searchValue });
  }

  function handleReset() {
    setSearchValue("");
    onFilterChange({
      search: "",
      sendStatus: "",
      reviewStatus: "",
      purposeId: "",
      categoryId: "",
      countryId: "",
      vehicleId: "",
      userId: "",
      dateFrom: "",
      dateTo: "",
    });
  }

  return (
    <Card className="space-y-4 p-4">
      <div className="space-y-1">
        <p className="text-sm font-medium uppercase tracking-[0.24em] text-muted-foreground">{eyebrow}</p>
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>

      {/* Search + expand toggle */}
      <div className="flex gap-2">
        <form onSubmit={handleSearchSubmit} className="flex flex-1 gap-2">
          <input
            type="search"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            placeholder="Suche (Lieferant, Bemerkung, KI-Text)..."
            className="h-10 flex-1 rounded-2xl border border-border bg-background px-4 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
          />
          <button
            type="submit"
            className="h-10 rounded-2xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
          >
            Suchen
          </button>
        </form>
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className={`h-10 rounded-2xl border px-4 text-sm font-medium transition ${
            hasFilters
              ? "border-primary/40 bg-primary/5 text-primary"
              : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-primary"
          }`}
        >
          Filter{hasFilters ? " aktiv" : ""}
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {isAdmin && exportHref ? (
            <a
              href={exportHref}
              className="rounded-2xl border border-border bg-card px-4 py-2 text-sm font-semibold transition hover:border-primary/40 hover:text-primary"
            >
              Export
            </a>
          ) : null}
          <a
            href="/receipts/new"
            className="rounded-2xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
          >
            Neuer Beleg
          </a>
        </div>
        {footerContent ? <div className="flex flex-wrap items-center gap-2">{footerContent}</div> : null}
      </div>

      {/* Status quick-filter chips */}
      <div className="flex flex-wrap gap-1.5">
        {SEND_STATUSES.map((s) => {
          const active = filters.sendStatus === s.value;
          return (
            <button
              key={s.value}
              type="button"
              onClick={() => onFilterChange({ sendStatus: active ? "" : s.value })}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                active
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary"
              }`}
            >
              {s.label}
            </button>
          );
        })}
      </div>

      {/* Expanded filter panel */}
      {expanded ? (
        <div className="grid gap-3 border-t border-border pt-4 sm:grid-cols-2 lg:grid-cols-4">
          <FilterSelect
            label="Pruefstatus"
            value={filters.reviewStatus}
            onChange={(v) => onFilterChange({ reviewStatus: v })}
            options={[...REVIEW_STATUS_OPTIONS]}
          />
          <FilterSelect
            label="Zweck"
            value={filters.purposeId}
            onChange={(v) => onFilterChange({ purposeId: v })}
            options={filterOptions.purposes.map((p) => ({ value: p.id, label: p.name }))}
          />
          <FilterSelect
            label="Kategorie"
            value={filters.categoryId}
            onChange={(v) => onFilterChange({ categoryId: v })}
            options={filterOptions.categories.map((c) => ({ value: c.id, label: c.name }))}
          />
          <FilterSelect
            label="Land"
            value={filters.countryId}
            onChange={(v) => onFilterChange({ countryId: v })}
            options={filterOptions.countries.map((c) => ({ value: c.id, label: c.label }))}
          />
          <FilterSelect
            label="Kfz"
            value={filters.vehicleId}
            onChange={(v) => onFilterChange({ vehicleId: v })}
            options={filterOptions.vehicles.map((v) => ({ value: v.id, label: v.label }))}
          />
          {isAdmin ? (
            <FilterSelect
              label="Benutzer"
              value={filters.userId}
              onChange={(v) => onFilterChange({ userId: v })}
              options={filterOptions.users.map((u) => ({ value: u.id, label: u.label }))}
            />
          ) : null}
          <label className="grid gap-1 text-sm">
            <span className="text-xs font-medium text-muted-foreground">Datum von</span>
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => onFilterChange({ dateFrom: e.target.value })}
              className="h-9 rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary"
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-xs font-medium text-muted-foreground">Datum bis</span>
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => onFilterChange({ dateTo: e.target.value })}
              className="h-9 rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary"
            />
          </label>
          <div className="flex items-end">
            <button
              type="button"
              onClick={handleReset}
              className="h-9 rounded-xl border border-border bg-card px-4 text-sm font-medium text-muted-foreground transition hover:border-danger/40 hover:text-danger"
            >
              Alle zuruecksetzen
            </button>
          </div>
        </div>
      ) : null}
    </Card>
  );
}

function FilterSelect({ label, value, onChange, options }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="grid gap-1 text-sm">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary"
      >
        <option value="">Alle</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}
