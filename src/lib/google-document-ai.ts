/**
 * Google Document AI Invoice Parser integration.
 *
 * Sends documents (images or PDFs) to Google Document AI, maps the structured
 * entities back to our OcrResult format, and fills gaps with the existing
 * regex-based parseReceiptText() for fields Google does not provide
 * (paymentMethod, cardLastDigits, country, documentType, special.*).
 */

import { DocumentProcessorServiceClient } from "@google-cloud/documentai";
import type {
  OcrConfidenceLevel,
  OcrDocumentType,
  OcrPaymentMethod,
} from "@/lib/ocr-suggestions";
import type { OcrResult, OcrSourceType, OcrInvoiceLineItem } from "@/lib/ocr";

// ---------------------------------------------------------------------------
// Transient-error detection
// ---------------------------------------------------------------------------

const TRANSIENT_GRPC_CODES = new Set(["UNAVAILABLE", "DEADLINE_EXCEEDED", "RESOURCE_EXHAUSTED"]);
const TRANSIENT_HTTP_CODES = new Set([429, 500, 502, 503, 504]);
const TRANSIENT_NETWORK_ERRORS = new Set(["ETIMEDOUT", "ECONNRESET", "EAI_AGAIN"]);

export function isTransientError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message ?? "";
  const code = (err as { code?: string | number }).code;

  if (typeof code === "string" && TRANSIENT_GRPC_CODES.has(code)) return true;
  if (typeof code === "number" && TRANSIENT_HTTP_CODES.has(code)) return true;
  if (typeof code === "string" && TRANSIENT_NETWORK_ERRORS.has(code)) return true;
  if (/ETIMEDOUT|ECONNRESET|EAI_AGAIN/i.test(msg)) return true;
  if (/503|502|504|429|unavailable|deadline.exceeded/i.test(msg)) return true;

  return false;
}

// ---------------------------------------------------------------------------
// MIME type mapping
// ---------------------------------------------------------------------------

function toGoogleMimeType(mimeType: string): string {
  switch (mimeType) {
    case "image/jpeg": return "image/jpeg";
    case "image/png": return "image/png";
    case "application/pdf": return "application/pdf";
    default: return "application/octet-stream";
  }
}

// ---------------------------------------------------------------------------
// Entity helpers
// ---------------------------------------------------------------------------

type GoogleEntity = {
  type?: string | null;
  mentionText?: string | null;
  normalizedValue?: {
    text?: string | null;
    moneyValue?: { amount?: number | null; currencyCode?: string | null } | null;
    dateValue?: { year?: number | null; month?: number | null; day?: number | null } | null;
  } | null;
  confidence?: number | null;
  properties?: GoogleEntity[] | null;
};

function findEntity(entities: GoogleEntity[], type: string): GoogleEntity | undefined {
  return entities.find((e) => e.type === type);
}

function findAllEntities(entities: GoogleEntity[], type: string): GoogleEntity[] {
  return entities.filter((e) => e.type === type);
}

function entityText(entity: GoogleEntity | undefined): string | null {
  if (!entity) return null;
  return entity.normalizedValue?.text?.trim() || entity.mentionText?.trim() || null;
}

function entityMoney(entity: GoogleEntity | undefined): number | null {
  if (!entity) return null;
  const money = entity.normalizedValue?.moneyValue;
  if (money?.amount != null) return money.amount;
  // Fallback: parse from mentionText
  const text = entity.mentionText?.replace(/[^\d.,\-]/g, "") ?? "";
  const cleaned = text.includes(",") && !text.includes(".")
    ? text.replace(",", ".")
    : text.replace(/,/g, "");
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

function entityDate(entity: GoogleEntity | undefined): string | null {
  if (!entity) return null;
  const dv = entity.normalizedValue?.dateValue;
  if (dv?.year && dv?.month && dv?.day) {
    return `${dv.year}-${String(dv.month).padStart(2, "0")}-${String(dv.day).padStart(2, "0")}`;
  }
  // Fallback: try ISO-ish text
  const text = entity.normalizedValue?.text ?? entity.mentionText ?? "";
  const iso = text.match(/(20\d{2})-(\d{2})-(\d{2})/);
  if (iso) return iso[0];
  return null;
}

function entityCurrency(entity: GoogleEntity | undefined): string | null {
  if (!entity) return null;
  const code = entity.normalizedValue?.moneyValue?.currencyCode;
  if (code) return code;
  const text = entity.mentionText ?? "";
  if (/€|EUR/i.test(text)) return "EUR";
  if (/\$|USD/i.test(text)) return "USD";
  if (/£|GBP/i.test(text)) return "GBP";
  if (/CHF/i.test(text)) return "CHF";
  return null;
}

function toConfidence(entity: GoogleEntity | undefined): OcrConfidenceLevel {
  if (!entity) return "none";
  const c = entity.confidence ?? 0;
  if (c >= 0.85) return "high";
  if (c >= 0.5) return "medium";
  if (c > 0) return "low";
  return "none";
}

function avgConfidence(entities: GoogleEntity[]): number {
  if (entities.length === 0) return 0;
  const sum = entities.reduce((acc, e) => acc + (e.confidence ?? 0), 0);
  return sum / entities.length;
}

// ---------------------------------------------------------------------------
// Line item mapping
// ---------------------------------------------------------------------------

function mapLineItems(entities: GoogleEntity[]): OcrInvoiceLineItem[] {
  const lineItemEntities = findAllEntities(entities, "line_item");
  return lineItemEntities.map((li, idx) => {
    const props = li.properties ?? [];
    const desc = entityText(findEntity(props, "line_item/description"))
      ?? entityText(findEntity(props, "line_item/product_code"))
      ?? "";
    const qty = entityMoney(findEntity(props, "line_item/quantity"));
    const unitPrice = entityMoney(findEntity(props, "line_item/unit_price"));
    const totalPrice = entityMoney(findEntity(props, "line_item/amount"));
    const confidence = toConfidence(li);

    return {
      lineNumber: idx + 1,
      description: desc.slice(0, 255),
      quantity: qty,
      unit: null,
      unitPrice,
      totalPrice,
      taxHint: entityText(findEntity(props, "line_item/tax_amount")) ?? null,
      confidence,
      status: confidence === "high" ? "confident" as const : "uncertain" as const,
    };
  });
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export async function analyzeWithGoogle(
  buffer: Buffer,
  mimeType: string,
): Promise<OcrResult> {
  const { env } = await import("@/lib/env");
  const apiEndpoint = `${env.GOOGLE_DOCUMENT_AI_LOCATION}-documentai.googleapis.com`;

  const client = new DocumentProcessorServiceClient({
    keyFilename: env.GOOGLE_APPLICATION_CREDENTIALS!,
    apiEndpoint,
  });

  const processorName = `projects/${env.GOOGLE_PROJECT_ID}/locations/${env.GOOGLE_DOCUMENT_AI_LOCATION}/processors/${env.GOOGLE_PROCESSOR_ID}`;

  const [response] = await client.processDocument({
    name: processorName,
    rawDocument: {
      content: buffer.toString("base64"),
      mimeType: toGoogleMimeType(mimeType),
    },
  });

  const document = response.document;
  if (!document) {
    throw new Error("Google Document AI returned no document.");
  }

  const rawText = document.text ?? "";
  const entities: GoogleEntity[] = (document.entities ?? []) as GoogleEntity[];

  // --- Map Google entities to our extracted fields ---
  const supplier = entityText(findEntity(entities, "supplier_name"));
  const invoiceNumber = entityText(findEntity(entities, "invoice_id"));
  const invoiceDate = entityDate(findEntity(entities, "invoice_date"));
  const dueDate = entityDate(findEntity(entities, "due_date"));
  const serviceDate = entityDate(findEntity(entities, "delivery_date"));

  const totalAmountEntity = findEntity(entities, "total_amount");
  const netAmountEntity = findEntity(entities, "net_amount");
  const taxAmountEntity = findEntity(entities, "total_tax_amount");

  const amount = entityMoney(totalAmountEntity);
  const netAmount = entityMoney(netAmountEntity);
  const taxAmount = entityMoney(taxAmountEntity);
  const currency = entityCurrency(totalAmountEntity)
    ?? entityCurrency(netAmountEntity)
    ?? entityCurrency(findEntity(entities, "currency"));
  const location = entityText(findEntity(entities, "supplier_address"));
  const lineItems = mapLineItems(entities);

  // --- Use regex parsing for fields Google does not provide ---
  // Import buildResult's underlying parseReceiptText to fill gaps
  const { buildResult: buildFallback } = await import("@/lib/ocr");
  const fallback = buildFallback(rawText, 0, mimeType === "application/pdf" ? "pdf-text" : "image");

  const sourceType: OcrSourceType = mimeType === "application/pdf" ? "pdf-text" : "image";
  const overallConfidence = entities.length > 0 ? avgConfidence(entities) : 0;

  const result: OcrResult = {
    sourceType,
    rawText,
    extracted: {
      date: invoiceDate ?? fallback.extracted.date,
      invoiceDate,
      dueDate,
      serviceDate,
      time: fallback.extracted.time,
      amount: amount ?? fallback.extracted.amount,
      grossAmount: amount ?? fallback.extracted.grossAmount,
      netAmount: netAmount ?? fallback.extracted.netAmount,
      taxAmount: taxAmount ?? fallback.extracted.taxAmount,
      currency: currency ?? fallback.extracted.currency,
      supplier: supplier ?? fallback.extracted.supplier,
      invoiceNumber: invoiceNumber ?? fallback.extracted.invoiceNumber,
      location: location ?? fallback.extracted.location,
      // These fields are not provided by Google — always use regex fallback
      paymentMethod: fallback.extracted.paymentMethod,
      cardLastDigits: fallback.extracted.cardLastDigits,
      countryCode: fallback.extracted.countryCode,
      countryName: fallback.extracted.countryName,
      documentType: fallback.extracted.documentType,
    },
    special: {
      ...fallback.special,
      invoice: lineItems.length > 0 ? { lineItems } : fallback.special.invoice,
    },
    confidence: overallConfidence,
    fieldConfidence: {
      date: invoiceDate ? toConfidence(findEntity(entities, "invoice_date")) : fallback.fieldConfidence.date,
      invoiceDate: toConfidence(findEntity(entities, "invoice_date")),
      dueDate: toConfidence(findEntity(entities, "due_date")),
      serviceDate: toConfidence(findEntity(entities, "delivery_date")),
      time: fallback.fieldConfidence.time,
      amount: amount != null ? toConfidence(totalAmountEntity) : fallback.fieldConfidence.amount,
      grossAmount: amount != null ? toConfidence(totalAmountEntity) : fallback.fieldConfidence.grossAmount,
      netAmount: netAmount != null ? toConfidence(netAmountEntity) : fallback.fieldConfidence.netAmount,
      taxAmount: taxAmount != null ? toConfidence(taxAmountEntity) : fallback.fieldConfidence.taxAmount,
      currency: currency ? "high" : fallback.fieldConfidence.currency,
      supplier: supplier ? toConfidence(findEntity(entities, "supplier_name")) : fallback.fieldConfidence.supplier,
      invoiceNumber: invoiceNumber ? toConfidence(findEntity(entities, "invoice_id")) : fallback.fieldConfidence.invoiceNumber,
      location: location ? toConfidence(findEntity(entities, "supplier_address")) : fallback.fieldConfidence.location,
      paymentMethod: fallback.fieldConfidence.paymentMethod,
      cardLastDigits: fallback.fieldConfidence.cardLastDigits,
      country: fallback.fieldConfidence.country,
      documentType: fallback.fieldConfidence.documentType,
    },
    specialConfidence: {
      ...fallback.specialConfidence,
      invoice: lineItems.length > 0
        ? { lineItems: lineItems.some((li) => li.confidence === "high") ? "high" : "medium" }
        : fallback.specialConfidence.invoice,
    },
    message: null,
  };

  return result;
}
