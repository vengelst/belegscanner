import type { OcrConfidenceLevel, OcrDocumentType } from "@/lib/ocr-suggestions";
import type { OcrInvoiceLineItem, OcrResult } from "@/lib/document-analysis";
import { getAiProvider, AiProviderError } from "@/lib/ai";
import type { ExtractionResult } from "@/lib/ai/types";

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

export async function analyzeWithOpenAITextMode(
  rawText: string,
  mimeType: string,
): Promise<OcrResult> {
  const provider = await getAiProvider();
  if (!provider) {
    throw new Error("Kein KI-Provider konfiguriert. Bitte konfigurieren Sie einen Provider in den KI-Einstellungen.");
  }

  try {
    const data = await provider.analyzeText(rawText);
    const lineItems = mapLineItems(data.lineItems);
    const builtRawText = buildRawText(data);
    const sourceType = mimeType === "application/pdf" ? "pdf" : "image";
    const message = data.warnings.length > 0 ? data.warnings.join("; ") : null;

    return {
      sourceType,
      rawText: builtRawText,
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
        documentType: data.documentType as OcrDocumentType | null,
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
  } catch (error) {
    if (error instanceof AiProviderError) {
      throw new Error(error.userMessage);
    }
    throw error;
  }
}

export async function analyzeWithOpenAI(
  buffer: Buffer,
  mimeType: string,
): Promise<OcrResult> {
  const provider = await getAiProvider();
  if (!provider) {
    throw new Error("Kein KI-Provider konfiguriert. Bitte konfigurieren Sie einen Provider in den KI-Einstellungen.");
  }

  try {
    const data = await provider.analyzeDocument(buffer, mimeType);
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
        documentType: data.documentType as OcrDocumentType | null,
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
  } catch (error) {
    if (error instanceof AiProviderError) {
      throw new Error(error.userMessage);
    }
    throw error;
  }
}
