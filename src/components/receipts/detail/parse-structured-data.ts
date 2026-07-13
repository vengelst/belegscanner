import { fieldReviewStatusLabels, paymentMethodLabels, type OcrFieldReviewStatus } from "@/lib/ocr-suggestions";

export type StructuredData = {
  extracted: {
    time: string | null;
    invoiceDate: string | null;
    dueDate: string | null;
    serviceDate: string | null;
    location: string | null;
    paymentMethod: keyof typeof paymentMethodLabels | null;
    cardLastDigits: string | null;
    invoiceNumber: string | null;
    grossAmount: number | null;
    netAmount: number | null;
    taxAmount: number | null;
    countryName: string | null;
  };
  fieldConfidence: {
    time: string;
    invoiceDate: string;
    dueDate: string;
    serviceDate: string;
    location: string;
    paymentMethod: string;
    cardLastDigits: string;
    invoiceNumber: string;
    grossAmount: string;
    netAmount: string;
    taxAmount: string;
    country: string;
  };
  fieldReviewStates?: Partial<Record<string, OcrFieldReviewStatus>>;
  special: {
    fuel: {
      liters: number | null;
      pricePerLiter: number | null;
      fuelType: string | null;
    } | null;
    hospitality: {
      location: string | null;
      subtotal: number | null;
      tip: number | null;
      lineItems: Array<{ label: string; amount: number | null }>;
    } | null;
    lodging: {
      location: string | null;
      nights: number | null;
      subtotal: number | null;
      tax: number | null;
      fees: number | null;
      lineItems: Array<{ label: string; amount: number | null }>;
    } | null;
    parking: {
      location: string | null;
      durationText: string | null;
      entryTime: string | null;
      exitTime: string | null;
    } | null;
    toll: {
      station: string | null;
      routeHint: string | null;
      vehicleClass: string | null;
    } | null;
    invoice: {
      lineItems: Array<{
        lineNumber: number | null;
        description: string;
        quantity: number | null;
        unit: string | null;
        unitPrice: number | null;
        totalPrice: number | null;
        taxHint: string | null;
        confidence: string;
        status: "confident" | "uncertain" | "partial";
      }>;
    } | null;
  };
  specialConfidence: {
    fuel: {
      liters: string;
      pricePerLiter: string;
      fuelType: string;
    } | null;
    hospitality: {
      location: string;
      subtotal: string;
      tip: string;
    } | null;
    lodging: {
      location: string;
      nights: string;
      subtotal: string;
      tax: string;
      fees: string;
      lineItems: string;
    } | null;
    parking: {
      location: string;
      durationText: string;
      entryTime: string;
      exitTime: string;
    } | null;
    toll: {
      station: string;
      routeHint: string;
      vehicleClass: string;
    } | null;
    invoice: {
      lineItems: string;
    } | null;
  };
};

export function parseStructuredData(value: unknown): StructuredData | null {
  if (!value || typeof value !== "object") return null;
  return value as StructuredData;
}

export function formatSuggestedValue(value: string, status: OcrFieldReviewStatus | undefined, confidence: string) {
  if (status) return `${value} (${fieldReviewStatusLabels[status]})`;
  if (confidence === "high") return `${value} (sicher)`;
  if (confidence === "medium") return `${value} (wahrscheinlich)`;
  if (confidence === "low") return `${value} (unsicher)`;
  return value;
}
