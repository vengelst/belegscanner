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

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function nearlyEqual(a: number, b: number, tolerance = 0.05): boolean {
  if (a === 0 && b === 0) return true;
  const base = Math.max(Math.abs(a), Math.abs(b), 0.01);
  return Math.abs(a - b) / base <= tolerance;
}

export type ReceiptAmountBasis = {
  gross: number | null;
  net: number | null;
  tax: number | null;
};

export type LineItemAmountRecalc = {
  /** Anzuzeigender Rechnungsbetrag (Brutto). */
  amount: number;
  net: number;
  tax: number;
  vatRatePercent: number | null;
  /** true, wenn die Positionssumme als Netto interpretiert wurde. */
  lineItemsAreNet: boolean;
  source: "reverse_charge" | "receipt_scale" | "receipt_rate" | "country_rate" | "fallback_net_eq_gross";
};

/**
 * Berechnet Brutto/Netto/MwSt neu, wenn Positionen (de)aktiviert werden.
 *
 * Prioritaet:
 * 1. Reverse Charge
 * 2. Anteile aus den Beleg-Summen (OCR-Brutto/Netto/Steuer) – behaelt die MwSt des Belegs
 * 3. Steuersatz aus dem Beleg (Steuer/Netto), sonst Laender-Satz
 * 4. Fallback: Netto = Summe, Steuer = 0 (nur wenn gar kein Satz bekannt)
 *
 * Erkennt ausserdem, ob Positionssummen eher dem Netto oder dem Brutto des Belegs entsprechen.
 */
export function recalculateAmountsFromLineItemSum({
  activeSum,
  allItemsSum,
  reverseCharge,
  countryVatRatePercent,
  receipt,
}: {
  activeSum: number;
  /** Summe aller Positionen (inkl. ausgeschlossener), zur Erkennung Netto vs. Brutto. */
  allItemsSum: number | null;
  reverseCharge: boolean;
  countryVatRatePercent: number | null;
  receipt: ReceiptAmountBasis;
}): LineItemAmountRecalc {
  const receiptGross = receipt.gross;
  const receiptNet = receipt.net;
  const receiptTax = receipt.tax;

  const lineItemsAreNet = Boolean(
    allItemsSum != null
    && receiptNet != null
    && receiptNet > 0
    && nearlyEqual(allItemsSum, receiptNet)
    && (receiptGross == null || !nearlyEqual(allItemsSum, receiptGross)),
  );

  if (reverseCharge) {
    if (lineItemsAreNet) {
      return {
        amount: activeSum,
        net: activeSum,
        tax: 0,
        vatRatePercent: null,
        lineItemsAreNet: true,
        source: "reverse_charge",
      };
    }
    return {
      amount: activeSum,
      net: activeSum,
      tax: 0,
      vatRatePercent: null,
      lineItemsAreNet: false,
      source: "reverse_charge",
    };
  }

  let vatRatePercent: number | null = null;
  if (receiptNet != null && receiptNet > 0 && receiptTax != null && receiptTax >= 0) {
    vatRatePercent = roundMoney((receiptTax / receiptNet) * 100);
  } else if (receiptGross != null && receiptNet != null && receiptNet > 0 && receiptGross > receiptNet) {
    vatRatePercent = roundMoney(((receiptGross - receiptNet) / receiptNet) * 100);
  } else if (countryVatRatePercent != null && countryVatRatePercent >= 0) {
    vatRatePercent = countryVatRatePercent;
  }

  // Beleg-Summen proportional skalieren (bevorzugt – exakte MwSt-Anteile des Belegs)
  if (
    !lineItemsAreNet
    && receiptGross != null
    && receiptGross > 0
    && receiptNet != null
    && receiptTax != null
  ) {
    const ratio = activeSum / receiptGross;
    const net = roundMoney(receiptNet * ratio);
    const tax = roundMoney(activeSum - net);
    return {
      amount: activeSum,
      net,
      tax,
      vatRatePercent,
      lineItemsAreNet: false,
      source: "receipt_scale",
    };
  }

  if (lineItemsAreNet && vatRatePercent != null) {
    const rate = vatRatePercent / 100;
    const net = activeSum;
    const amount = roundMoney(net * (1 + rate));
    const tax = roundMoney(amount - net);
    return {
      amount,
      net,
      tax,
      vatRatePercent,
      lineItemsAreNet: true,
      source: vatRatePercent === countryVatRatePercent ? "country_rate" : "receipt_rate",
    };
  }

  if (lineItemsAreNet && receiptGross != null && receiptNet != null && receiptNet > 0 && receiptTax != null) {
    const ratio = activeSum / receiptNet;
    const net = activeSum;
    const tax = roundMoney(receiptTax * ratio);
    const amount = roundMoney(net + tax);
    return {
      amount,
      net,
      tax,
      vatRatePercent,
      lineItemsAreNet: true,
      source: "receipt_scale",
    };
  }

  if (vatRatePercent != null) {
    const { net, tax } = splitGrossByVatRate(activeSum, vatRatePercent);
    return {
      amount: activeSum,
      net,
      tax,
      vatRatePercent,
      lineItemsAreNet: false,
      source: countryVatRatePercent != null && vatRatePercent === countryVatRatePercent
        ? "country_rate"
        : "receipt_rate",
    };
  }

  return {
    amount: activeSum,
    net: activeSum,
    tax: 0,
    vatRatePercent: null,
    lineItemsAreNet,
    source: "fallback_net_eq_gross",
  };
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
