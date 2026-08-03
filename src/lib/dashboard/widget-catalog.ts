export type WidgetSize = "sm" | "md" | "lg";

export type WidgetConfig = {
  id: string;
  type: string;
  visible: boolean;
  order: number;
  size?: WidgetSize;
  titleOverride?: string;
};

export type WidgetDefinition = {
  type: string;
  defaultTitle: string;
  description: string;
  defaultSize: WidgetSize;
  category: "kpi" | "problems" | "period" | "group";
};

export const WIDGET_CATALOG: WidgetDefinition[] = [
  // KPI widgets
  { type: "kpi_total_receipts", defaultTitle: "Belege gesamt", description: "Gesamtanzahl aller Belege", defaultSize: "sm", category: "kpi" },
  { type: "kpi_creditor_sum", defaultTitle: "Kreditoren (Eingang)", description: "Summe EUR aller Kreditorenbelege", defaultSize: "sm", category: "kpi" },
  { type: "kpi_debitor_sum", defaultTitle: "Debitoren (Ausgang)", description: "Summe EUR aller Debitorenbelege", defaultSize: "sm", category: "kpi" },
  { type: "kpi_failed_sends", defaultTitle: "Versandfehler", description: "Anzahl fehlgeschlagener Versendungen", defaultSize: "sm", category: "kpi" },
  { type: "kpi_creditor_count", defaultTitle: "Kreditorenbelege", description: "Anzahl Kreditorenbelege", defaultSize: "sm", category: "kpi" },
  { type: "kpi_debitor_count", defaultTitle: "Debitorenbelege", description: "Anzahl Debitorenbelege", defaultSize: "sm", category: "kpi" },
  { type: "kpi_foreign_currency", defaultTitle: "Fremdwaehrungsbelege", description: "Anzahl Belege in Fremdwaehrung", defaultSize: "sm", category: "kpi" },
  { type: "kpi_total_sum", defaultTitle: "Summe gesamt (nur Info)", description: "Gesamtsumme aller Belege in EUR", defaultSize: "sm", category: "kpi" },

  // Problems
  { type: "problems", defaultTitle: "Handlungsbedarf", description: "Belege mit fehlenden oder unvollstaendigen Angaben", defaultSize: "lg", category: "problems" },

  // Period selectors
  { type: "period_day", defaultTitle: "Nach Tag", description: "Tagesansicht mit Auswahl", defaultSize: "md", category: "period" },
  { type: "period_week", defaultTitle: "Nach Woche", description: "Wochenansicht mit Auswahl", defaultSize: "md", category: "period" },
  { type: "period_month", defaultTitle: "Nach Monat", description: "Monatsansicht mit Auswahl", defaultSize: "md", category: "period" },

  // Group tables
  { type: "group_status", defaultTitle: "Versandstatus", description: "Verteilung nach Versandstatus", defaultSize: "md", category: "group" },
  { type: "group_review_status", defaultTitle: "Pruefstatus", description: "Verteilung nach Pruefstatus", defaultSize: "md", category: "group" },
  { type: "group_currency", defaultTitle: "Originalbetraege nach Waehrung", description: "Aufschluesselung nach Waehrung", defaultSize: "md", category: "group" },
  { type: "group_user", defaultTitle: "Nach Benutzer", description: "Gruppierung nach Benutzer", defaultSize: "md", category: "group" },
  { type: "group_purpose", defaultTitle: "Nach Zweck", description: "Gruppierung nach Zweck", defaultSize: "md", category: "group" },
  { type: "group_party_role", defaultTitle: "Nach Belegrichtung", description: "Gruppierung nach Belegrichtung", defaultSize: "md", category: "group" },
  { type: "group_payment_method", defaultTitle: "Nach Zahlungsweise", description: "Gruppierung nach Zahlungsweise", defaultSize: "md", category: "group" },
  { type: "group_country", defaultTitle: "Nach Land", description: "Gruppierung nach Land", defaultSize: "md", category: "group" },
];

export function getDefaultLayout(): WidgetConfig[] {
  return WIDGET_CATALOG.map((def, index) => ({
    id: def.type,
    type: def.type,
    visible: true,
    order: index,
    size: def.defaultSize,
  }));
}

export function getWidgetDefinition(type: string): WidgetDefinition | undefined {
  return WIDGET_CATALOG.find((w) => w.type === type);
}

export function mergeWithCatalog(saved: WidgetConfig[]): WidgetConfig[] {
  const savedMap = new Map(saved.map((w) => [w.type, w]));
  const result: WidgetConfig[] = [];

  for (const s of saved) {
    if (WIDGET_CATALOG.some((c) => c.type === s.type)) {
      result.push(s);
    }
  }

  for (const def of WIDGET_CATALOG) {
    if (!savedMap.has(def.type)) {
      result.push({
        id: def.type,
        type: def.type,
        visible: false,
        order: result.length,
        size: def.defaultSize,
      });
    }
  }

  return result;
}
