"use client";

import { useState, useCallback } from "react";
import { Card } from "@/components/ui/card";
import type { WidgetConfig } from "@/lib/dashboard/widget-catalog";
import { WIDGET_CATALOG, getWidgetDefinition } from "@/lib/dashboard/widget-catalog";

type Props = {
  widgets: WidgetConfig[];
  onSave: (widgets: WidgetConfig[]) => Promise<void>;
  onReset: () => Promise<void>;
  onCancel: () => void;
};

const SIZE_LABELS: Record<string, string> = {
  sm: "Klein",
  md: "Mittel",
  lg: "Gross",
};

const CATEGORY_LABELS: Record<string, string> = {
  kpi: "KPI-Karten",
  problems: "Problemuebersicht",
  period: "Zeitraeume",
  group: "Gruppierungen",
};

export function DashboardEditPanel({ widgets, onSave, onReset, onCancel }: Props) {
  const [items, setItems] = useState<WidgetConfig[]>(
    () => [...widgets].sort((a, b) => a.order - b.order),
  );
  const [saving, setSaving] = useState(false);

  const toggleVisible = useCallback((id: string) => {
    setItems((prev) =>
      prev.map((w) => (w.id === id ? { ...w, visible: !w.visible } : w)),
    );
  }, []);

  const moveUp = useCallback((index: number) => {
    if (index <= 0) return;
    setItems((prev) => {
      const next = [...prev];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next.map((w, i) => ({ ...w, order: i }));
    });
  }, []);

  const moveDown = useCallback((index: number) => {
    setItems((prev) => {
      if (index >= prev.length - 1) return prev;
      const next = [...prev];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      return next.map((w, i) => ({ ...w, order: i }));
    });
  }, []);

  const changeSize = useCallback((id: string, size: "sm" | "md" | "lg") => {
    setItems((prev) =>
      prev.map((w) => (w.id === id ? { ...w, size } : w)),
    );
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await onSave(items.map((w, i) => ({ ...w, order: i })));
    } finally {
      setSaving(false);
    }
  }, [items, onSave]);

  const handleReset = useCallback(async () => {
    setSaving(true);
    try {
      await onReset();
    } finally {
      setSaving(false);
    }
  }, [onReset]);

  const grouped = WIDGET_CATALOG.reduce<Record<string, typeof WIDGET_CATALOG>>((acc, def) => {
    if (!acc[def.category]) acc[def.category] = [];
    acc[def.category].push(def);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-2">
          <p className="text-sm font-medium uppercase tracking-[0.24em] text-muted-foreground">Dashboard</p>
          <h1 className="text-3xl font-semibold tracking-tight">Layout bearbeiten</h1>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleReset}
            disabled={saving}
            className="h-9 rounded-xl border border-border px-3 text-sm text-muted-foreground transition hover:text-danger disabled:opacity-50"
          >
            Auf Standard zuruecksetzen
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="h-9 rounded-xl border border-border px-3 text-sm text-muted-foreground transition hover:text-foreground disabled:opacity-50"
          >
            Abbrechen
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="h-9 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Speichern..." : "Speichern"}
          </button>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        Widgets ein-/ausblenden, Reihenfolge aendern und Groesse anpassen.
        Aenderungen gelten fuer alle Benutzer.
      </p>

      <div className="space-y-2">
        {items.map((item, index) => {
          const def = getWidgetDefinition(item.type);
          if (!def) return null;
          const category = grouped[def.category];
          const isFirstOfCategory = category && items.findIndex((w) => {
            const d = getWidgetDefinition(w.type);
            return d?.category === def.category;
          }) === index;

          return (
            <div key={item.id}>
              {isFirstOfCategory ? (
                <h2 className="mt-6 mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {CATEGORY_LABELS[def.category] ?? def.category}
                </h2>
              ) : null}
              <Card className={`flex items-center gap-4 p-3 transition ${!item.visible ? "opacity-50" : ""}`}>
                <div className="flex flex-col gap-1">
                  <button
                    type="button"
                    onClick={() => moveUp(index)}
                    disabled={index === 0}
                    className="h-6 w-6 rounded text-xs leading-none text-muted-foreground transition hover:bg-muted disabled:opacity-30"
                    aria-label="Nach oben"
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    onClick={() => moveDown(index)}
                    disabled={index === items.length - 1}
                    className="h-6 w-6 rounded text-xs leading-none text-muted-foreground transition hover:bg-muted disabled:opacity-30"
                    aria-label="Nach unten"
                  >
                    ▼
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => toggleVisible(item.id)}
                  className={`h-8 w-8 shrink-0 rounded-lg border text-sm font-bold transition ${
                    item.visible
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background text-muted-foreground"
                  }`}
                  aria-label={item.visible ? "Ausblenden" : "Einblenden"}
                >
                  {item.visible ? "✓" : ""}
                </button>

                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{item.titleOverride || def.defaultTitle}</p>
                  <p className="text-xs text-muted-foreground">{def.description}</p>
                </div>

                <select
                  value={item.size ?? def.defaultSize}
                  onChange={(e) => changeSize(item.id, e.target.value as "sm" | "md" | "lg")}
                  className="h-8 rounded-lg border border-border bg-background px-2 text-xs"
                >
                  <option value="sm">{SIZE_LABELS.sm}</option>
                  <option value="md">{SIZE_LABELS.md}</option>
                  <option value="lg">{SIZE_LABELS.lg}</option>
                </select>
              </Card>
            </div>
          );
        })}
      </div>
    </div>
  );
}
