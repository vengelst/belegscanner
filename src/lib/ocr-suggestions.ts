export const OCR_DOCUMENT_TYPES = ["general", "fuel", "hospitality", "lodging", "parking", "toll"] as const;
export type OcrDocumentType = (typeof OCR_DOCUMENT_TYPES)[number];

export const RECEIPT_DOCUMENT_TYPE_VALUES = ["GENERAL", "FUEL", "HOSPITALITY", "LODGING", "PARKING", "TOLL"] as const;
export type ReceiptDocumentType = (typeof RECEIPT_DOCUMENT_TYPE_VALUES)[number];

export const OCR_CONFIDENCE_LEVELS = ["high", "medium", "low", "none"] as const;
export type OcrConfidenceLevel = (typeof OCR_CONFIDENCE_LEVELS)[number];

export const OCR_PAYMENT_METHODS = ["cash", "visa", "mastercard", "credit_card", "debit_card", "paypal", "sepa", "bank_transfer", "unknown"] as const;
export type OcrPaymentMethod = (typeof OCR_PAYMENT_METHODS)[number];

export const OCR_FIELD_REVIEW_STATUSES = [
  "detected_confident",
  "detected_uncertain",
  "not_detected",
  "user_confirmed",
  "user_overridden",
] as const;
export type OcrFieldReviewStatus = (typeof OCR_FIELD_REVIEW_STATUSES)[number];

export const documentTypeLabels: Record<OcrDocumentType, string> = {
  general: "Allgemeiner Beleg",
  fuel: "Tankbeleg",
  hospitality: "Bewirtungsbeleg",
  lodging: "Unterkunft / Hotel",
  parking: "Parkbeleg",
  toll: "Mautbeleg",
};

export const paymentMethodLabels: Record<OcrPaymentMethod, string> = {
  cash: "Barzahlung",
  visa: "Visa",
  mastercard: "Mastercard",
  credit_card: "Kreditkarte",
  debit_card: "Debitkarte",
  paypal: "PayPal",
  sepa: "SEPA-Lastschrift",
  bank_transfer: "Ueberweisung",
  unknown: "Unklare Kartenzahlung",
};

export const fieldReviewStatusLabels: Record<OcrFieldReviewStatus, string> = {
  detected_confident: "KI sicher",
  detected_uncertain: "KI unsicher",
  not_detected: "nicht erkannt",
  user_confirmed: "manuell bestaetigt",
  user_overridden: "manuell gesetzt",
};

export function toReceiptDocumentType(value: OcrDocumentType | null | undefined): ReceiptDocumentType | null {
  if (!value) return null;
  return value.toUpperCase() as ReceiptDocumentType;
}

export function fromReceiptDocumentType(value: string | null | undefined): OcrDocumentType | null {
  if (!value) return null;
  const normalized = value.toLowerCase();
  return OCR_DOCUMENT_TYPES.includes(normalized as OcrDocumentType)
    ? (normalized as OcrDocumentType)
    : null;
}

export function formatConfidenceLabel(level: OcrConfidenceLevel | undefined) {
  switch (level) {
    case "high":
      return "sicher";
    case "medium":
      return "wahrscheinlich";
    case "low":
      return "unsicher";
    default:
      return "ohne Bewertung";
  }
}

export function confidenceToReviewStatus(level: OcrConfidenceLevel | undefined): OcrFieldReviewStatus {
  switch (level) {
    case "high":
      return "detected_confident";
    case "medium":
    case "low":
      return "detected_uncertain";
    default:
      return "not_detected";
  }
}
