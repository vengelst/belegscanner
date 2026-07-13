import type { OcrResult } from "@/lib/document-analysis";

export type Purpose = { id: string; name: string; isHospitality: boolean };
export type Category = { id: string; name: string };
export type Country = { id: string; name: string; code: string | null; currencyCode: string | null };
export type Vehicle = { id: string; plate: string; description: string | null };

export type ReceiptSelectionState = {
  purposeId: string;
  categoryId: string;
  countryId: string;
  vehicleId: string;
};

export type PrefillSource = "session" | "defaults" | "none";
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

const LAST_SELECTIONS_STORAGE_KEY = "belegbox.receipts.last-selection.v1";

export function readLastSelections(): Partial<ReceiptSelectionState> | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(LAST_SELECTIONS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ReceiptSelectionState>;
    return parsed;
  } catch {
    return null;
  }
}

export function persistLastSelections(selection: ReceiptSelectionState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LAST_SELECTIONS_STORAGE_KEY, JSON.stringify(selection));
}

export function resolveSelectionState({
  sessionSelections,
  userDefaults,
  validIds,
}: {
  sessionSelections: Partial<ReceiptSelectionState> | null;
  userDefaults: UserDefaults;
  validIds: ValidIds;
}): { selection: ReceiptSelectionState; source: PrefillSource } {
  const selection: ReceiptSelectionState = {
    purposeId: "",
    categoryId: "",
    countryId: "",
    vehicleId: "",
  };

  const pickValue = (sessionValue: string | null | undefined, defaultValue: string | null | undefined, ids: Set<string>) => {
    if (sessionValue && ids.has(sessionValue)) return { value: sessionValue, source: "session" as const };
    if (defaultValue && ids.has(defaultValue)) return { value: defaultValue, source: "defaults" as const };
    return { value: "", source: "none" as const };
  };

  const purpose = pickValue(sessionSelections?.purposeId, userDefaults.defaultPurposeId, validIds.purposes);
  const category = pickValue(sessionSelections?.categoryId, userDefaults.defaultCategoryId, validIds.categories);
  const country = pickValue(sessionSelections?.countryId, userDefaults.defaultCountryId, validIds.countries);
  const vehicle = pickValue(sessionSelections?.vehicleId, userDefaults.defaultVehicleId, validIds.vehicles);

  selection.purposeId = purpose.value;
  selection.categoryId = category.value;
  selection.countryId = country.value;
  selection.vehicleId = vehicle.value;

  const sources = [purpose.source, category.source, country.source, vehicle.source];
  if (sources.includes("session")) return { selection, source: "session" };
  if (sources.includes("defaults")) return { selection, source: "defaults" };
  return { selection, source: "none" };
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
