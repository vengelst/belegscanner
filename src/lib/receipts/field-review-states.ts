import type { OcrResult } from "@/lib/document-analysis";
import { confidenceToReviewStatus, type OcrFieldReviewStatus } from "@/lib/ocr-suggestions";

export type OcrFieldKey = keyof Pick<
  OcrResult["extracted"],
  "date" | "dueDate" | "amount" | "currency" | "supplier" | "invoiceNumber" | "netAmount" | "taxAmount" | "serviceDate" | "grossAmount"
>;

export type FieldReviewStateMap = Partial<Record<
  | "date" | "invoiceDate" | "dueDate" | "serviceDate"
  | "amount" | "grossAmount" | "netAmount" | "taxAmount"
  | "currency" | "supplier" | "partyRole" | "invoiceNumber"
  | "country" | "documentType" | "paymentMethod" | "cardLastDigits"
  | "invoiceLineItems"
  | "fuelLiters" | "fuelPricePerLiter" | "fuelType"
  | "hospitalityLocation" | "hospitalitySubtotal" | "hospitalityTip"
  | "lodgingLocation" | "lodgingNights" | "lodgingSubtotal" | "lodgingTax" | "lodgingFees"
  | "parkingLocation" | "parkingDuration" | "parkingEntryTime" | "parkingExitTime"
  | "tollStation" | "tollRouteHint" | "tollVehicleClass",
  OcrFieldReviewStatus
>>;

export function hasDetectedOcrValues(result: OcrResult) {
  const fuel = result.special.fuel;
  const hospitality = result.special.hospitality;
  const lodging = result.special.lodging;
  const parking = result.special.parking;
  const toll = result.special.toll;

  return Boolean(
    result.extracted.date
      || result.extracted.invoiceDate
      || result.extracted.dueDate
      || result.extracted.serviceDate
      || result.extracted.time
      || result.extracted.amount !== null
      || result.extracted.grossAmount !== null
      || result.extracted.netAmount !== null
      || result.extracted.taxAmount !== null
      || result.extracted.currency
      || result.extracted.supplier
      || result.extracted.partyRole
      || result.extracted.invoiceNumber
      || result.extracted.location
      || result.extracted.countryCode
      || result.extracted.countryName
      || result.extracted.paymentMethod
      || result.extracted.cardLastDigits
      || (result.special.invoice && result.special.invoice.lineItems.length > 0)
      || (fuel && (fuel.liters !== null || fuel.pricePerLiter !== null || fuel.fuelType))
      || (hospitality && (hospitality.location || hospitality.subtotal !== null || hospitality.tip !== null || hospitality.lineItems.length > 0))
      || (lodging && (lodging.location || lodging.nights !== null || lodging.subtotal !== null || lodging.tax !== null || lodging.fees !== null || lodging.lineItems.length > 0))
      || (parking && (parking.location || parking.durationText || parking.entryTime || parking.exitTime))
      || (toll && (toll.station || toll.routeHint || toll.vehicleClass)),
  );
}

export type StructuredDataFieldOverrides = {
  date?: string;
  dueDate?: string;
  amount?: number | null;
  netAmount?: number | null;
  taxAmount?: number | null;
  currency?: string | null;
  supplier?: string | null;
  /** Formular erlaubt bis 80 Zeichen; AI-Schema nur 40 – hier kuerzen. */
  invoiceNumber?: string | null;
};

/**
 * Baut die gespeicherte OCR-Struktur. Manuelle Formularwerte haben Vorrang
 * vor Scanner-Daten, damit spaetere Anzeige/Validierung nicht den Scan
 * wieder ueber die Nutzereingabe legt.
 */
export function buildStructuredData(
  result: OcrResult,
  fieldReviewStates: FieldReviewStateMap,
  overrides?: StructuredDataFieldOverrides,
) {
  const invoiceNumber = overrides?.invoiceNumber !== undefined
    ? (overrides.invoiceNumber ? overrides.invoiceNumber.slice(0, 40) : null)
    : result.extracted.invoiceNumber;

  return {
    sourceType: result.sourceType,
    extracted: {
      ...result.extracted,
      date: overrides?.date !== undefined ? (overrides.date || null) : result.extracted.date,
      dueDate: overrides?.dueDate !== undefined ? (overrides.dueDate || null) : result.extracted.dueDate,
      amount: overrides?.amount !== undefined ? overrides.amount : result.extracted.amount,
      grossAmount: overrides?.amount !== undefined
        ? overrides.amount
        : result.extracted.grossAmount,
      netAmount: overrides?.netAmount !== undefined ? overrides.netAmount : result.extracted.netAmount,
      taxAmount: overrides?.taxAmount !== undefined ? overrides.taxAmount : result.extracted.taxAmount,
      currency: overrides?.currency !== undefined ? overrides.currency : result.extracted.currency,
      supplier: overrides?.supplier !== undefined ? overrides.supplier : result.extracted.supplier,
      invoiceNumber,
    },
    fieldConfidence: result.fieldConfidence,
    fieldReviewStates,
    special: result.special,
    specialConfidence: result.specialConfidence,
  };
}

export function buildFieldReviewStates({
  result,
  manualOverrides,
  countryManuallyChanged,
  hospitalityLocationManual,
  selectedCountryId,
  suggestedCountryId,
  submitted,
}: {
  result: OcrResult;
  manualOverrides: Record<OcrFieldKey, boolean>;
  countryManuallyChanged: boolean;
  hospitalityLocationManual: boolean;
  selectedCountryId: string;
  suggestedCountryId: string | null;
  submitted: boolean;
}): FieldReviewStateMap {
  const states: FieldReviewStateMap = {
    date: manualOverrides.date ? "user_overridden" : submitted && result.extracted.date ? "user_confirmed" : confidenceToReviewStatus(result.fieldConfidence.date),
    invoiceDate: submitted && result.extracted.invoiceDate ? "user_confirmed" : confidenceToReviewStatus(result.fieldConfidence.invoiceDate),
    dueDate: manualOverrides.dueDate ? "user_overridden" : submitted && result.extracted.dueDate ? "user_confirmed" : confidenceToReviewStatus(result.fieldConfidence.dueDate),
    serviceDate: submitted && result.extracted.serviceDate ? "user_confirmed" : confidenceToReviewStatus(result.fieldConfidence.serviceDate),
    amount: manualOverrides.amount ? "user_overridden" : submitted && result.extracted.amount !== null ? "user_confirmed" : confidenceToReviewStatus(result.fieldConfidence.amount),
    grossAmount: submitted && result.extracted.grossAmount !== null ? "user_confirmed" : confidenceToReviewStatus(result.fieldConfidence.grossAmount),
    netAmount: submitted && result.extracted.netAmount !== null ? "user_confirmed" : confidenceToReviewStatus(result.fieldConfidence.netAmount),
    taxAmount: submitted && result.extracted.taxAmount !== null ? "user_confirmed" : confidenceToReviewStatus(result.fieldConfidence.taxAmount),
    currency: manualOverrides.currency ? "user_overridden" : submitted && result.extracted.currency ? "user_confirmed" : confidenceToReviewStatus(result.fieldConfidence.currency),
    supplier: manualOverrides.supplier ? "user_overridden" : submitted && result.extracted.supplier ? "user_confirmed" : confidenceToReviewStatus(result.fieldConfidence.supplier),
    partyRole: submitted && result.extracted.partyRole ? "user_confirmed" : confidenceToReviewStatus(result.fieldConfidence.partyRole),
    invoiceNumber: submitted && result.extracted.invoiceNumber ? "user_confirmed" : confidenceToReviewStatus(result.fieldConfidence.invoiceNumber),
    documentType: submitted && result.extracted.documentType ? "user_confirmed" : confidenceToReviewStatus(result.fieldConfidence.documentType),
    paymentMethod: submitted && result.extracted.paymentMethod ? "user_confirmed" : confidenceToReviewStatus(result.fieldConfidence.paymentMethod),
    cardLastDigits: submitted && result.extracted.cardLastDigits ? "user_confirmed" : confidenceToReviewStatus(result.fieldConfidence.cardLastDigits),
    invoiceLineItems: result.special.invoice ? confidenceToReviewStatus(result.specialConfidence.invoice?.lineItems) : "not_detected",
    country: result.extracted.countryCode
      ? countryManuallyChanged && selectedCountryId !== suggestedCountryId
        ? "user_overridden"
        : submitted && selectedCountryId && selectedCountryId === suggestedCountryId
          ? "user_confirmed"
          : confidenceToReviewStatus(result.fieldConfidence.country)
      : "not_detected",
    fuelLiters: result.special.fuel ? confidenceToReviewStatus(result.specialConfidence.fuel?.liters) : "not_detected",
    fuelPricePerLiter: result.special.fuel ? confidenceToReviewStatus(result.specialConfidence.fuel?.pricePerLiter) : "not_detected",
    fuelType: result.special.fuel ? confidenceToReviewStatus(result.specialConfidence.fuel?.fuelType) : "not_detected",
    hospitalityLocation: result.special.hospitality
      ? hospitalityLocationManual
        ? "user_overridden"
        : submitted && result.special.hospitality.location
          ? "user_confirmed"
          : confidenceToReviewStatus(result.specialConfidence.hospitality?.location)
      : "not_detected",
    hospitalitySubtotal: result.special.hospitality ? confidenceToReviewStatus(result.specialConfidence.hospitality?.subtotal) : "not_detected",
    hospitalityTip: result.special.hospitality ? confidenceToReviewStatus(result.specialConfidence.hospitality?.tip) : "not_detected",
    lodgingLocation: result.special.lodging ? confidenceToReviewStatus(result.specialConfidence.lodging?.location) : "not_detected",
    lodgingNights: result.special.lodging ? confidenceToReviewStatus(result.specialConfidence.lodging?.nights) : "not_detected",
    lodgingSubtotal: result.special.lodging ? confidenceToReviewStatus(result.specialConfidence.lodging?.subtotal) : "not_detected",
    lodgingTax: result.special.lodging ? confidenceToReviewStatus(result.specialConfidence.lodging?.tax) : "not_detected",
    lodgingFees: result.special.lodging ? confidenceToReviewStatus(result.specialConfidence.lodging?.fees) : "not_detected",
    parkingLocation: result.special.parking ? confidenceToReviewStatus(result.specialConfidence.parking?.location) : "not_detected",
    parkingDuration: result.special.parking ? confidenceToReviewStatus(result.specialConfidence.parking?.durationText) : "not_detected",
    parkingEntryTime: result.special.parking ? confidenceToReviewStatus(result.specialConfidence.parking?.entryTime) : "not_detected",
    parkingExitTime: result.special.parking ? confidenceToReviewStatus(result.specialConfidence.parking?.exitTime) : "not_detected",
    tollStation: result.special.toll ? confidenceToReviewStatus(result.specialConfidence.toll?.station) : "not_detected",
    tollRouteHint: result.special.toll ? confidenceToReviewStatus(result.specialConfidence.toll?.routeHint) : "not_detected",
    tollVehicleClass: result.special.toll ? confidenceToReviewStatus(result.specialConfidence.toll?.vehicleClass) : "not_detected",
  };

  return states;
}
