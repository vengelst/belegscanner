import type { OcrResult } from "@/lib/document-analysis";

export type Purpose = { id: string; name: string; isHospitality: boolean };
export type Category = { id: string; name: string };
export type Country = {
  id: string;
  name: string;
  code: string | null;
  currencyCode: string | null;
  vatRatePercent: number | null;
};

/** Split gross amount into net + tax using a VAT percent (e.g. 19). */
export function splitGrossByVatRate(amount: number, vatRatePercent: number): { net: number; tax: number } {
  const rate = vatRatePercent / 100;
  const net = Math.round((amount / (1 + rate)) * 100) / 100;
  const tax = Math.round((amount - net) * 100) / 100;
  return { net, tax };
}
export type Vehicle = { id: string; plate: string; description: string | null };

export type ReceiptSelectionState = {
  purposeId: string;
  categoryId: string;
  countryId: string;
  vehicleId: string;
};

export type PrefillSource = "defaults" | "none";
export type CaptureSource = "upload" | "camera";
export type CaptureTrigger = "manual" | "auto";

export type UserDefaults = {
  defaultCountryId: string | null;
  defaultVehicleId: string | null;
  defaultPurposeId: string | null;
  defaultCategoryId: string | null;
};

export type ValidIds = {
  purposes: Set<string>;
  categories: Set<string>;
  countries: Set<string>;
  vehicles: Set<string>;
};

/**
 * Vorbelegung der Zuordnung. Bewusst ausschliesslich aus den User-Standardwerten:
 * Angaben des vorherigen Belegs werden nie uebernommen.
 */
export function resolveSelectionState({
  userDefaults,
  validIds,
}: {
  userDefaults: UserDefaults;
  validIds: ValidIds;
}): { selection: ReceiptSelectionState; source: PrefillSource } {
  const pickValue = (defaultValue: string | null | undefined, ids: Set<string>) =>
    defaultValue && ids.has(defaultValue) ? defaultValue : "";

  const selection: ReceiptSelectionState = {
    purposeId: pickValue(userDefaults.defaultPurposeId, validIds.purposes),
    categoryId: pickValue(userDefaults.defaultCategoryId, validIds.categories),
    countryId: pickValue(userDefaults.defaultCountryId, validIds.countries),
    vehicleId: pickValue(userDefaults.defaultVehicleId, validIds.vehicles),
  };

  const hasDefault = Object.values(selection).some((value) => value !== "");
  return { selection, source: hasDefault ? "defaults" : "none" };
}

export type ExcludableLineItem = { excluded?: boolean };

export function isLineItemActive(item: ExcludableLineItem): boolean {
  return item.excluded !== true;
}

export type LineItemSummary = {
  totalCount: number;
  activeCount: number;
  /** Summe der aktiven Positionen mit Betrag; null, wenn keine aktive Position einen Betrag hat. */
  activeSum: number | null;
};

/** Fasst eine Positionsliste zusammen: aktive Positionen zaehlen und deren Betraege summieren. */
export function sumActiveLineItems<T extends ExcludableLineItem>(
  items: T[],
  getAmount: (item: T) => number | null,
): LineItemSummary {
  const active = items.filter(isLineItemActive);
  const amounts = active
    .map(getAmount)
    .filter((value): value is number => value !== null && Number.isFinite(value));

  return {
    totalCount: items.length,
    activeCount: active.length,
    activeSum: amounts.length > 0
      ? Math.round(amounts.reduce((sum, value) => sum + value, 0) * 100) / 100
      : null,
  };
}

/**
 * Leitet Netto und Steuer aus einem Bruttobetrag ab. Liefert null, wenn kein
 * Steuersatz bekannt ist (dann bleibt die Aufteilung dem Nutzer ueberlassen).
 */
export function deriveNetAndTax({
  gross,
  vatRatePercent,
  reverseCharge,
}: {
  gross: number;
  vatRatePercent: number | null;
  reverseCharge: boolean;
}): { net: number; tax: number } | null {
  if (reverseCharge) return { net: gross, tax: 0 };
  if (vatRatePercent == null || vatRatePercent < 0) return null;
  return splitGrossByVatRate(gross, vatRatePercent);
}

export function parseLocalizedNumber(value: string): number | null {
  const normalized = value.trim().replace(",", ".");
  if (!normalized) return null;
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function formatLocalizedNumber(value: number, maximumFractionDigits = 2): string {
  return value.toLocaleString("de-DE", {
    minimumFractionDigits: 2,
    maximumFractionDigits,
  });
}

export function buildCurrencyOptions(countries: Country[]) {
  const unique = new Set<string>();

  for (const country of countries) {
    if (country.currencyCode?.trim()) unique.add(country.currencyCode.trim().toUpperCase());
  }

  return Array.from(unique)
    .sort((a, b) => (a === "EUR" ? -1 : b === "EUR" ? 1 : a.localeCompare(b)))
    .map((code) => ({ value: code, label: code }));
}

export function getAnalysisHeadline(sourceType: OcrResult["sourceType"]): string {
  switch (sourceType) {
    case "pdf":
      return "ChatGPT hat das PDF analysiert und strukturierte Vorschlaege vorbelegt; manuelle Eingaben bleiben jederzeit moeglich";
    default:
      return "ChatGPT hat den Beleg analysiert und strukturierte Vorschlaege vorbelegt; manuelle Eingaben bleiben jederzeit moeglich";
  }
}

export function getApiErrorMessage(data: unknown, fallback: string): string {
  if (!data || typeof data !== "object") return fallback;

  const error = "error" in data && typeof data.error === "string" ? data.error : fallback;
  const details = "details" in data && data.details && typeof data.details === "object"
    ? Object.values(data.details as Record<string, unknown>)
        .flatMap((value) => Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [])
    : [];

  if (details.length === 0) return error;
  return `${error} ${details.join(" ")}`.trim();
}
