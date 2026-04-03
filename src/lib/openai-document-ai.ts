/**
 * OpenAI-based document extraction for BelegBox.
 *
 * Sends images/PDFs to OpenAI's Responses API with a structured JSON schema.
 * For PDFs, additionally extracts local text via pdf-parse and runs the existing
 * regex parser on it. OpenAI results are then plausibility-checked against the
 * local parse: semantic fields (supplier, invoiceNumber, dates) trust OpenAI,
 * while monetary fields (amounts) are cross-checked and flagged on mismatch.
 */

import OpenAI from "openai";
import type { OcrConfidenceLevel } from "@/lib/ocr-suggestions";
import type { OcrResult, OcrSourceType, OcrInvoiceLineItem } from "@/lib/ocr";

// ---------------------------------------------------------------------------
// Structured warning type (matches OcrResult.warnings)
// ---------------------------------------------------------------------------

type OcrWarning = {
  field: string;
  type: "mismatch" | "plausibility" | "info";
  message: string;
  openaiValue?: string | number | null;
  localValue?: string | number | null;
};

// ---------------------------------------------------------------------------
// Transient-error detection
// ---------------------------------------------------------------------------

const TRANSIENT_STATUS_CODES = new Set([429, 500, 502, 503, 504, 529]);

export function isTransientError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const status = (err as { status?: number }).status;
  if (typeof status === "number" && TRANSIENT_STATUS_CODES.has(status)) return true;
  const code = (err as { code?: string }).code;
  if (code === "ETIMEDOUT" || code === "ECONNRESET") return true;
  if (/timeout|rate.limit|overloaded|529|503|502/i.test(err.message)) return true;
  return false;
}

// ---------------------------------------------------------------------------
// Response JSON schema (sent to OpenAI for structured output)
// ---------------------------------------------------------------------------

const EXTRACTION_SCHEMA = {
  type: "object" as const,
  properties: {
    supplier: { type: ["string", "null"] as const, description: "Name of the vendor / invoice issuer (NOT the recipient/customer)" },
    invoiceNumber: { type: ["string", "null"] as const, description: "Invoice number / Rechnungsnummer" },
    invoiceDate: { type: ["string", "null"] as const, description: "Invoice date in YYYY-MM-DD format" },
    dueDate: { type: ["string", "null"] as const, description: "Payment due date in YYYY-MM-DD format" },
    serviceDate: { type: ["string", "null"] as const, description: "Service/delivery date in YYYY-MM-DD format, if different from invoice date" },
    currency: { type: ["string", "null"] as const, description: "ISO 4217 currency code (e.g. EUR, USD, CHF)" },
    grossAmount: { type: ["number", "null"] as const, description: "Final payable amount / total due / Zahlbetrag / Endbetrag (including tax). This is the amount the recipient must pay." },
    netAmount: { type: ["number", "null"] as const, description: "Net amount before tax (Nettobetrag / Zwischensumme Netto)" },
    taxAmount: { type: ["number", "null"] as const, description: "Total tax amount (MwSt / USt / VAT)" },
    paymentMethod: {
      type: ["string", "null"] as const,
      enum: ["cash", "credit_card", "debit_card", "bank_transfer", null],
      description: "Payment method if mentioned",
    },
    supplierAddress: { type: ["string", "null"] as const, description: "Supplier street address, city, postal code" },
    countryCode: { type: ["string", "null"] as const, description: "ISO 3166-1 alpha-2 country code of the supplier (e.g. DE, AT, US)" },
    lineItems: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          description: { type: "string" as const },
          quantity: { type: ["number", "null"] as const },
          unit: { type: ["string", "null"] as const },
          unitPrice: { type: ["number", "null"] as const },
          totalPrice: { type: ["number", "null"] as const },
          taxHint: { type: ["string", "null"] as const, description: "Tax rate or hint, e.g. '19%'" },
        },
        required: ["description", "quantity", "unit", "unitPrice", "totalPrice", "taxHint"],
        additionalProperties: false,
      },
      description: "Invoice line items / positions",
    },
    warnings: {
      type: "array" as const,
      items: { type: "string" as const },
      description: "Any quality warnings, e.g. 'amount could not be clearly read', 'multiple dates found'",
    },
  },
  required: [
    "supplier", "invoiceNumber", "invoiceDate", "dueDate", "serviceDate",
    "currency", "grossAmount", "netAmount", "taxAmount", "paymentMethod",
    "supplierAddress", "countryCode", "lineItems", "warnings",
  ],
  additionalProperties: false,
};

type ExtractionResult = {
  supplier: string | null;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  dueDate: string | null;
  serviceDate: string | null;
  currency: string | null;
  grossAmount: number | null;
  netAmount: number | null;
  taxAmount: number | null;
  paymentMethod: string | null;
  supplierAddress: string | null;
  countryCode: string | null;
  lineItems: Array<{
    description: string;
    quantity: number | null;
    unit: string | null;
    unitPrice: number | null;
    totalPrice: number | null;
    taxHint: string | null;
  }>;
  warnings: string[];
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mapPaymentMethod(raw: string | null): "cash" | "credit_card" | "debit_card" | "unknown" | null {
  if (!raw) return null;
  switch (raw) {
    case "cash": return "cash";
    case "credit_card": return "credit_card";
    case "debit_card": return "debit_card";
    case "bank_transfer": return "unknown";
    default: return "unknown";
  }
}

function mapLineItems(items: ExtractionResult["lineItems"]): OcrInvoiceLineItem[] {
  return items.map((item, idx) => ({
    lineNumber: idx + 1,
    description: item.description.slice(0, 255),
    quantity: item.quantity,
    unit: item.unit,
    unitPrice: item.unitPrice,
    totalPrice: item.totalPrice,
    taxHint: item.taxHint,
    confidence: "high" as OcrConfidenceLevel,
    status: "confident" as const,
  }));
}

function toDataUrl(buffer: Buffer, mimeType: string): string {
  return `data:${mimeType};base64,${buffer.toString("base64")}`;
}

function amountsMatch(a: number | null, b: number | null, tolerance = 0.05): boolean {
  if (a == null || b == null) return false;
  const diff = Math.abs(a - b);
  if (diff <= tolerance) return true;
  const relTolerance = Math.max(Math.abs(a), Math.abs(b)) * 0.02;
  return diff <= relTolerance;
}

function fmt(n: number | null): string {
  return n == null ? "–" : n.toFixed(2);
}

// ---------------------------------------------------------------------------
// Plausibility merge
// ---------------------------------------------------------------------------

type MergedField<T> = { value: T | null; confidence: OcrConfidenceLevel };

/**
 * Merge a monetary field from OpenAI and local parsing.
 *
 * For the main amount (grossAmount), OpenAI is preferred because it understands
 * "Zahlbetrag" / "amount due" semantics, while the local regex parser often
 * picks up "Zwischensumme Netto" as the largest keyword-matched number.
 *
 * When both sources agree (within tolerance), confidence is "high".
 * When they disagree, OpenAI is used with "low" confidence and a structured warning.
 * When only one source has a value, it gets "medium" confidence.
 */
function mergeAmount(
  openai: number | null,
  local: number | null,
  warnings: OcrWarning[],
  field: string,
  label: string,
): MergedField<number> {
  if (openai == null && local == null) return { value: null, confidence: "none" };
  if (openai == null) return { value: local, confidence: "medium" };
  if (local == null) return { value: openai, confidence: "medium" };

  if (amountsMatch(openai, local)) {
    return { value: openai, confidence: "high" };
  }

  warnings.push({
    field,
    type: "mismatch",
    message: `${label}: OpenAI ${fmt(openai)}, lokal ${fmt(local)} — bitte pruefen`,
    openaiValue: openai,
    localValue: local,
  });
  return { value: openai, confidence: "low" };
}

function mergeString(
  openai: string | null,
  local: string | null,
): MergedField<string> {
  if (openai) return { value: openai, confidence: "high" };
  if (local) return { value: local, confidence: "medium" };
  return { value: null, confidence: "none" };
}

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are a precise document data extractor for German and international business receipts and invoices.

Rules:
- Extract ONLY the invoice issuer/vendor as "supplier", NEVER the recipient/customer/bill-to party
- grossAmount MUST be the final payable amount (Zahlbetrag / Endbetrag / Amount Due / Total Due / Zu zahlender Betrag), NOT a subtotal or net amount
- netAmount is the amount before tax (Nettobetrag / Zwischensumme Netto)
- taxAmount is the tax (MwSt / USt / VAT)
- All dates must be YYYY-MM-DD format
- All amounts must be plain numbers (no currency symbols)
- Currency must be ISO 4217 (EUR, USD, CHF, etc.)
- If a field is not present or unreadable, return null
- Add warnings for any ambiguous or uncertain values
- For line items, extract all visible positions with available detail
- Country code refers to the SUPPLIER's country, not the recipient`;

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export async function analyzeWithOpenAI(
  buffer: Buffer,
  mimeType: string,
): Promise<OcrResult> {
  const { env } = await import("@/lib/env");

  const client = new OpenAI({ apiKey: env.OPENAI_API_KEY! });
  const model = env.OPENAI_MODEL ?? "gpt-4o-mini";

  // --- Step 1: For PDFs, extract local text for plausibility checks ---
  let localRawText = "";
  if (mimeType === "application/pdf") {
    const { extractPdfText } = await import("@/lib/ocr");
    localRawText = await extractPdfText(buffer);
  }

  // --- Step 2: Call OpenAI Responses API ---
  const documentInput: OpenAI.Responses.ResponseInputContent = mimeType === "application/pdf"
    ? {
        type: "input_file",
        filename: "document.pdf",
        file_data: toDataUrl(buffer, "application/pdf"),
      }
    : {
        type: "input_image",
        image_url: toDataUrl(buffer, mimeType),
        detail: "high",
      };

  const response = await client.responses.create({
    model,
    input: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          documentInput,
          { type: "input_text", text: "Extract all invoice/receipt data from this document." },
        ],
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "invoice_extraction",
        schema: EXTRACTION_SCHEMA,
        strict: true,
      },
    },
  });

  const outputText = response.output.find((item) => item.type === "message")
    ?.content.find((c) => c.type === "output_text")
    ?.text;

  if (!outputText) {
    throw new Error("OpenAI returned no text output.");
  }

  const data: ExtractionResult = JSON.parse(outputText);

  // --- Step 3: Build local regex fallback from real PDF text ---
  const { buildResult: buildFallback } = await import("@/lib/ocr");
  const sourceType: OcrSourceType = mimeType === "application/pdf" ? "pdf-text" : "image";
  const fallback = localRawText ? buildFallback(localRawText, 0, sourceType) : null;

  // --- Step 4: Plausibility merge ---
  const structuredWarnings: OcrWarning[] = [];

  // Convert OpenAI's free-text warnings to structured info warnings
  for (const w of data.warnings ?? []) {
    structuredWarnings.push({ field: "general", type: "info", message: w });
  }

  // Semantic fields: trust OpenAI
  const supplier = mergeString(data.supplier, fallback?.extracted.supplier ?? null);
  const invoiceNumber = mergeString(data.invoiceNumber, fallback?.extracted.invoiceNumber ?? null);
  const invoiceDate = mergeString(data.invoiceDate, fallback?.extracted.invoiceDate ?? null);
  const dueDate = mergeString(data.dueDate, fallback?.extracted.dueDate ?? null);
  const serviceDate = mergeString(data.serviceDate, fallback?.extracted.serviceDate ?? null);
  const currency = mergeString(data.currency, fallback?.extracted.currency ?? null);

  // Monetary fields: cross-check.
  // For grossAmount, compare OpenAI against the local parser's "amount" field.
  // The local parser's "amount" often picks up the largest keyword-matched number,
  // which may be the net amount on invoices where "Zwischensumme Netto" appears
  // before "Zahlbetrag". OpenAI is instructed to pick the final payable amount.
  const grossAmount = mergeAmount(data.grossAmount, fallback?.extracted.amount ?? null, structuredWarnings, "grossAmount", "Bruttobetrag");
  const netAmount = mergeAmount(data.netAmount, fallback?.extracted.netAmount ?? null, structuredWarnings, "netAmount", "Nettobetrag");
  const taxAmount = mergeAmount(data.taxAmount, fallback?.extracted.taxAmount ?? null, structuredWarnings, "taxAmount", "Steuerbetrag");

  // Internal plausibility: net + tax ≈ gross?
  if (grossAmount.value != null && netAmount.value != null && taxAmount.value != null) {
    const expectedGross = netAmount.value + taxAmount.value;
    if (!amountsMatch(grossAmount.value, expectedGross, 0.10)) {
      structuredWarnings.push({
        field: "grossAmount",
        type: "plausibility",
        message: `Netto (${fmt(netAmount.value)}) + MwSt (${fmt(taxAmount.value)}) = ${fmt(expectedGross)}, aber Brutto = ${fmt(grossAmount.value)}`,
        openaiValue: grossAmount.value,
        localValue: expectedGross,
      });
      grossAmount.confidence = "low";
    }
  }

  const amount = grossAmount.value ?? fallback?.extracted.amount ?? null;
  const amountConf = grossAmount.value != null ? grossAmount.confidence : (fallback?.fieldConfidence.amount ?? "none");

  // Build human-readable message from structured warnings (backwards-compatible)
  const importantWarnings = structuredWarnings.filter((w) => w.type !== "info");
  const infoWarnings = structuredWarnings.filter((w) => w.type === "info");
  const messageParts: string[] = [];
  if (importantWarnings.length > 0) {
    messageParts.push(importantWarnings.map((w) => w.message).join("; "));
  }
  if (infoWarnings.length > 0) {
    messageParts.push(infoWarnings.map((w) => w.message).join("; "));
  }

  const result: OcrResult = {
    sourceType,
    rawText: localRawText,
    extracted: {
      date: invoiceDate.value ?? fallback?.extracted.date ?? null,
      invoiceDate: invoiceDate.value,
      dueDate: dueDate.value,
      serviceDate: serviceDate.value,
      time: fallback?.extracted.time ?? null,
      amount,
      grossAmount: grossAmount.value,
      netAmount: netAmount.value,
      taxAmount: taxAmount.value,
      currency: currency.value,
      supplier: supplier.value,
      invoiceNumber: invoiceNumber.value,
      location: data.supplierAddress ?? fallback?.extracted.location ?? null,
      paymentMethod: mapPaymentMethod(data.paymentMethod) ?? fallback?.extracted.paymentMethod ?? null,
      cardLastDigits: fallback?.extracted.cardLastDigits ?? null,
      countryCode: data.countryCode ?? fallback?.extracted.countryCode ?? null,
      countryName: fallback?.extracted.countryName ?? null,
      documentType: fallback?.extracted.documentType ?? null,
    },
    special: {
      fuel: fallback?.special.fuel ?? null,
      hospitality: fallback?.special.hospitality ?? null,
      lodging: fallback?.special.lodging ?? null,
      parking: fallback?.special.parking ?? null,
      toll: fallback?.special.toll ?? null,
      invoice: data.lineItems.length > 0
        ? { lineItems: mapLineItems(data.lineItems) }
        : (fallback?.special.invoice ?? null),
    },
    confidence: 0.95,
    fieldConfidence: {
      date: invoiceDate.confidence,
      invoiceDate: invoiceDate.confidence,
      dueDate: dueDate.confidence,
      serviceDate: serviceDate.confidence,
      time: fallback?.fieldConfidence.time ?? "none",
      amount: amountConf,
      grossAmount: grossAmount.confidence,
      netAmount: netAmount.confidence,
      taxAmount: taxAmount.confidence,
      currency: currency.confidence,
      supplier: supplier.confidence,
      invoiceNumber: invoiceNumber.confidence,
      location: data.supplierAddress ? "high" : (fallback?.fieldConfidence.location ?? "none"),
      paymentMethod: data.paymentMethod ? "high" : (fallback?.fieldConfidence.paymentMethod ?? "none"),
      cardLastDigits: fallback?.fieldConfidence.cardLastDigits ?? "none",
      country: data.countryCode ? "high" : (fallback?.fieldConfidence.country ?? "none"),
      documentType: fallback?.fieldConfidence.documentType ?? "none",
    },
    specialConfidence: {
      fuel: fallback?.specialConfidence.fuel ?? null,
      hospitality: fallback?.specialConfidence.hospitality ?? null,
      lodging: fallback?.specialConfidence.lodging ?? null,
      parking: fallback?.specialConfidence.parking ?? null,
      toll: fallback?.specialConfidence.toll ?? null,
      invoice: data.lineItems.length > 0
        ? { lineItems: "high" }
        : (fallback?.specialConfidence.invoice ?? null),
    },
    message: messageParts.length > 0 ? messageParts.join(" | ") : null,
    warnings: structuredWarnings.length > 0 ? structuredWarnings : undefined,
  };

  return result;
}
