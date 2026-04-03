import type {
  OcrConfidenceLevel,
  OcrDocumentType,
  OcrPaymentMethod,
} from "@/lib/ocr-suggestions";

export type DocumentAnalysisSourceType = "image" | "pdf";

export type DocumentAnalysisLineItem = {
  label: string;
  amount: number | null;
};

export type DocumentAnalysisInvoiceLineItemStatus = "confident" | "uncertain" | "partial";

export type DocumentAnalysisInvoiceLineItem = {
  lineNumber: number | null;
  description: string;
  quantity: number | null;
  unit: string | null;
  unitPrice: number | null;
  totalPrice: number | null;
  taxHint: string | null;
  confidence: OcrConfidenceLevel;
  status: DocumentAnalysisInvoiceLineItemStatus;
};

export type DocumentAnalysisResult = {
  sourceType: DocumentAnalysisSourceType;
  rawText: string;
  extracted: {
    date: string | null;
    invoiceDate: string | null;
    dueDate: string | null;
    serviceDate: string | null;
    time: string | null;
    amount: number | null;
    grossAmount: number | null;
    netAmount: number | null;
    taxAmount: number | null;
    currency: string | null;
    supplier: string | null;
    invoiceNumber: string | null;
    location: string | null;
    paymentMethod: OcrPaymentMethod | null;
    cardLastDigits: string | null;
    countryCode: string | null;
    countryName: string | null;
    documentType: OcrDocumentType | null;
  };
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
      lineItems: DocumentAnalysisLineItem[];
    } | null;
    lodging: {
      location: string | null;
      nights: number | null;
      subtotal: number | null;
      tax: number | null;
      fees: number | null;
      lineItems: DocumentAnalysisLineItem[];
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
      lineItems: DocumentAnalysisInvoiceLineItem[];
    } | null;
  };
  confidence: number;
  fieldConfidence: {
    date: OcrConfidenceLevel;
    invoiceDate: OcrConfidenceLevel;
    dueDate: OcrConfidenceLevel;
    serviceDate: OcrConfidenceLevel;
    time: OcrConfidenceLevel;
    amount: OcrConfidenceLevel;
    grossAmount: OcrConfidenceLevel;
    netAmount: OcrConfidenceLevel;
    taxAmount: OcrConfidenceLevel;
    currency: OcrConfidenceLevel;
    supplier: OcrConfidenceLevel;
    invoiceNumber: OcrConfidenceLevel;
    location: OcrConfidenceLevel;
    paymentMethod: OcrConfidenceLevel;
    cardLastDigits: OcrConfidenceLevel;
    country: OcrConfidenceLevel;
    documentType: OcrConfidenceLevel;
  };
  specialConfidence: {
    fuel: {
      liters: OcrConfidenceLevel;
      pricePerLiter: OcrConfidenceLevel;
      fuelType: OcrConfidenceLevel;
    } | null;
    hospitality: {
      location: OcrConfidenceLevel;
      subtotal: OcrConfidenceLevel;
      tip: OcrConfidenceLevel;
      lineItems: OcrConfidenceLevel;
    } | null;
    lodging: {
      location: OcrConfidenceLevel;
      nights: OcrConfidenceLevel;
      subtotal: OcrConfidenceLevel;
      tax: OcrConfidenceLevel;
      fees: OcrConfidenceLevel;
      lineItems: OcrConfidenceLevel;
    } | null;
    parking: {
      location: OcrConfidenceLevel;
      durationText: OcrConfidenceLevel;
      entryTime: OcrConfidenceLevel;
      exitTime: OcrConfidenceLevel;
    } | null;
    toll: {
      station: OcrConfidenceLevel;
      routeHint: OcrConfidenceLevel;
      vehicleClass: OcrConfidenceLevel;
    } | null;
    invoice: {
      lineItems: OcrConfidenceLevel;
    } | null;
  };
  message: string | null;
  warnings?: Array<{
    field: string;
    type: "mismatch" | "plausibility" | "info";
    message: string;
    openaiValue?: string | number | null;
    localValue?: string | number | null;
  }>;
};

// Legacy aliases keep the existing component code stable while the product
// language moves from "OCR" to "KI-Auslese".
export type OcrSourceType = DocumentAnalysisSourceType;
export type OcrLineItem = DocumentAnalysisLineItem;
export type OcrInvoiceLineItemStatus = DocumentAnalysisInvoiceLineItemStatus;
export type OcrInvoiceLineItem = DocumentAnalysisInvoiceLineItem;
export type OcrResult = DocumentAnalysisResult;
