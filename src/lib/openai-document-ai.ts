import OpenAI from "openai";
import type { OcrConfidenceLevel, OcrDocumentType } from "@/lib/ocr-suggestions";
import type { OcrInvoiceLineItem, OcrResult } from "@/lib/document-analysis";

type ExtractionResult = {
  supplier: string | null;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  dueDate: string | null;
  serviceDate: string | null;
  time: string | null;
  currency: string | null;
  grossAmount: number | null;
  netAmount: number | null;
  taxAmount: number | null;
  paymentMethod: string | null;
  cardLastDigits: string | null;
  location: string | null;
  countryCode: string | null;
  countryName: string | null;
  documentType: OcrDocumentType | null;
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

const EXTRACTION_SCHEMA = {
  type: "object" as const,
  properties: {
    supplier: { type: ["string", "null"] as const },
    invoiceNumber: { type: ["string", "null"] as const },
    invoiceDate: { type: ["string", "null"] as const },
    dueDate: { type: ["string", "null"] as const },
    serviceDate: { type: ["string", "null"] as const },
    time: { type: ["string", "null"] as const },
    currency: { type: ["string", "null"] as const },
    grossAmount: { type: ["number", "null"] as const },
    netAmount: { type: ["number", "null"] as const },
    taxAmount: { type: ["number", "null"] as const },
    paymentMethod: {
      type: ["string", "null"] as const,
      enum: ["cash", "visa", "mastercard", "credit_card", "debit_card", "paypal", "sepa", "bank_transfer", "unknown", null],
    },
    cardLastDigits: { type: ["string", "null"] as const },
    location: { type: ["string", "null"] as const },
    countryCode: { type: ["string", "null"] as const },
    countryName: { type: ["string", "null"] as const },
    documentType: {
      type: ["string", "null"] as const,
      enum: ["general", "fuel", "hospitality", "lodging", "parking", "toll", null],
    },
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
          taxHint: { type: ["string", "null"] as const },
        },
        required: ["description", "quantity", "unit", "unitPrice", "totalPrice", "taxHint"],
        additionalProperties: false,
      },
    },
    warnings: {
      type: "array" as const,
      items: { type: "string" as const },
    },
  },
  required: [
    "supplier",
    "invoiceNumber",
    "invoiceDate",
    "dueDate",
    "serviceDate",
    "time",
    "currency",
    "grossAmount",
    "netAmount",
    "taxAmount",
    "paymentMethod",
    "cardLastDigits",
    "location",
    "countryCode",
    "countryName",
    "documentType",
    "lineItems",
    "warnings",
  ],
  additionalProperties: false,
};

const SYSTEM_PROMPT = `You extract structured data from business receipts and invoices for accounting.

Rules:
- Extract the issuer/vendor as supplier, never the bill-to recipient
- grossAmount is the final payable amount
- netAmount is the amount before tax
- taxAmount is the total tax amount
- paymentMethod must detect cash, Visa, Mastercard, PayPal, SEPA direct debit, bank transfer or generic card when visible
- All dates must be YYYY-MM-DD when possible
- Currency must be ISO 4217 like EUR or USD
- documentType must be one of: general, fuel, hospitality, lodging, parking, toll
- Return null when a field cannot be read confidently
- Add warnings when values are ambiguous or likely incomplete`;

function mapPaymentMethod(raw: string | null): "cash" | "visa" | "mastercard" | "credit_card" | "debit_card" | "paypal" | "sepa" | "bank_transfer" | "unknown" | null {
  if (!raw) return null;
  switch (raw) {
    case "cash":
      return "cash";
    case "visa":
      return "visa";
    case "mastercard":
      return "mastercard";
    case "credit_card":
      return "credit_card";
    case "debit_card":
      return "debit_card";
    case "paypal":
      return "paypal";
    case "sepa":
      return "sepa";
    case "bank_transfer":
      return "bank_transfer";
    case "unknown":
      return "unknown";
    default:
      return "unknown";
  }
}

function toDataUrl(buffer: Buffer, mimeType: string): string {
  return `data:${mimeType};base64,${buffer.toString("base64")}`;
}

function confidence(value: unknown): OcrConfidenceLevel {
  if (value === null || value === undefined || value === "") return "none";
  return "high";
}

function mapLineItems(items: ExtractionResult["lineItems"]): OcrInvoiceLineItem[] {
  return items.map((item, index) => ({
    lineNumber: index + 1,
    description: item.description.slice(0, 255),
    quantity: item.quantity,
    unit: item.unit,
    unitPrice: item.unitPrice,
    totalPrice: item.totalPrice,
    taxHint: item.taxHint ? item.taxHint.slice(0, 40) : null,
    confidence: "high",
    status: "confident",
  }));
}

function buildRawText(data: ExtractionResult): string {
  const lines = [
    data.supplier ? `Lieferant: ${data.supplier}` : null,
    data.invoiceNumber ? `Rechnungsnummer: ${data.invoiceNumber}` : null,
    data.invoiceDate ? `Rechnungsdatum: ${data.invoiceDate}` : null,
    data.dueDate ? `Faelligkeit: ${data.dueDate}` : null,
    data.serviceDate ? `Leistungsdatum: ${data.serviceDate}` : null,
    data.time ? `Uhrzeit: ${data.time}` : null,
    data.grossAmount !== null ? `Brutto: ${data.grossAmount}` : null,
    data.netAmount !== null ? `Netto: ${data.netAmount}` : null,
    data.taxAmount !== null ? `Steuer: ${data.taxAmount}` : null,
    data.currency ? `Waehrung: ${data.currency}` : null,
    data.paymentMethod ? `Zahlungsart: ${data.paymentMethod}` : null,
    data.cardLastDigits ? `Kartenendziffern: ${data.cardLastDigits}` : null,
    data.location ? `Ort: ${data.location}` : null,
    data.countryName ? `Land: ${data.countryName}` : data.countryCode ? `Land: ${data.countryCode}` : null,
    data.documentType ? `Belegtyp: ${data.documentType}` : null,
    ...data.lineItems.map((item) => {
      const amount = item.totalPrice !== null ? ` ${item.totalPrice}` : "";
      return `Position: ${item.description}${amount}`;
    }),
    ...data.warnings.map((warning) => `Hinweis: ${warning}`),
  ];

  return lines.filter(Boolean).join("\n");
}

export async function analyzeWithOpenAI(
  buffer: Buffer,
  mimeType: string,
): Promise<OcrResult> {
  const { env } = await import("@/lib/env");
  const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  const model = env.OPENAI_MODEL ?? "gpt-4o-mini";

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
          {
            type: "input_text",
            text: "Lies den Beleg aus und gib nur die strukturierten Daten gemaess Schema zurueck.",
          },
        ],
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "receipt_extraction",
        schema: EXTRACTION_SCHEMA,
        strict: true,
      },
    },
  });

  const outputText = response.output
    .find((item) => item.type === "message")
    ?.content.find((content) => content.type === "output_text")
    ?.text;

  if (!outputText) {
    throw new Error("ChatGPT hat keine strukturierte Antwort geliefert.");
  }

  const data: ExtractionResult = JSON.parse(outputText);
  const lineItems = mapLineItems(data.lineItems);
  const rawText = buildRawText(data);
  const sourceType = mimeType === "application/pdf" ? "pdf" : "image";
  const message = data.warnings.length > 0 ? data.warnings.join("; ") : null;

  return {
    sourceType,
    rawText,
    extracted: {
      date: data.invoiceDate ?? data.serviceDate ?? null,
      invoiceDate: data.invoiceDate,
      dueDate: data.dueDate,
      serviceDate: data.serviceDate,
      time: data.time,
      amount: data.grossAmount,
      grossAmount: data.grossAmount,
      netAmount: data.netAmount,
      taxAmount: data.taxAmount,
      currency: data.currency,
      supplier: data.supplier,
      invoiceNumber: data.invoiceNumber,
      location: data.location,
      paymentMethod: mapPaymentMethod(data.paymentMethod),
      cardLastDigits: data.cardLastDigits,
      countryCode: data.countryCode,
      countryName: data.countryName,
      documentType: data.documentType,
    },
    special: {
      fuel: null,
      hospitality: null,
      lodging: null,
      parking: null,
      toll: null,
      invoice: lineItems.length > 0 ? { lineItems } : null,
    },
    confidence: 0.9,
    fieldConfidence: {
      date: confidence(data.invoiceDate ?? data.serviceDate),
      invoiceDate: confidence(data.invoiceDate),
      dueDate: confidence(data.dueDate),
      serviceDate: confidence(data.serviceDate),
      time: confidence(data.time),
      amount: confidence(data.grossAmount),
      grossAmount: confidence(data.grossAmount),
      netAmount: confidence(data.netAmount),
      taxAmount: confidence(data.taxAmount),
      currency: confidence(data.currency),
      supplier: confidence(data.supplier),
      invoiceNumber: confidence(data.invoiceNumber),
      location: confidence(data.location),
      paymentMethod: confidence(data.paymentMethod),
      cardLastDigits: confidence(data.cardLastDigits),
      country: confidence(data.countryCode ?? data.countryName),
      documentType: confidence(data.documentType),
    },
    specialConfidence: {
      fuel: null,
      hospitality: null,
      lodging: null,
      parking: null,
      toll: null,
      invoice: lineItems.length > 0 ? { lineItems: "high" } : null,
    },
    message,
    warnings: data.warnings.map((warning) => ({
      field: "general",
      type: "info",
      message: warning,
    })),
  };
}
