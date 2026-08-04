export type AiProvider = "openai" | "anthropic" | "google";

export type AiModel = {
  id: string;
  name: string;
  provider: AiProvider;
};

export const AI_PROVIDERS: Record<AiProvider, { name: string; models: AiModel[] }> = {
  openai: {
    name: "OpenAI",
    models: [
      { id: "gpt-4o", name: "GPT-4o", provider: "openai" },
      { id: "gpt-4o-mini", name: "GPT-4o Mini", provider: "openai" },
      { id: "gpt-4-turbo", name: "GPT-4 Turbo", provider: "openai" },
    ],
  },
  anthropic: {
    name: "Anthropic",
    models: [
      { id: "claude-sonnet-4-20250514", name: "Claude Sonnet 4", provider: "anthropic" },
      { id: "claude-3-5-sonnet-20241022", name: "Claude 3.5 Sonnet", provider: "anthropic" },
      { id: "claude-3-haiku-20240307", name: "Claude 3 Haiku", provider: "anthropic" },
    ],
  },
  google: {
    name: "Google",
    models: [
      { id: "gemini-1.5-pro", name: "Gemini 1.5 Pro", provider: "google" },
      { id: "gemini-1.5-flash", name: "Gemini 1.5 Flash", provider: "google" },
      { id: "gemini-2.0-flash-exp", name: "Gemini 2.0 Flash", provider: "google" },
    ],
  },
};

export type AiConfig = {
  provider: AiProvider;
  model: string;
  apiKey: string;
  baseUrl?: string;
  ocrServiceUrl?: string;
};

export type ExtractionPartyRole = "CREDITOR" | "DEBTOR" | null;

export type ExtractionResult = {
  supplier: string | null;
  partyRole: ExtractionPartyRole;
  issuerName: string | null;
  recipientName: string | null;
  issuerVatId: string | null;
  recipientVatId: string | null;
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
  documentType: string | null;
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

export interface AiProviderInterface {
  analyzeDocument(buffer: Buffer, mimeType: string): Promise<ExtractionResult>;
  analyzeText(rawText: string): Promise<ExtractionResult>;
  testConnection(): Promise<{ success: boolean; message: string }>;
}

/** Legacy default prompt without company identity (incoming-invoice behaviour). */
export const SYSTEM_PROMPT = `You extract structured data from business receipts and invoices for accounting.

Rules:
- grossAmount is the final payable amount
- netAmount is the amount before tax
- taxAmount is the total tax amount
- paymentMethod must detect cash, Visa, Mastercard, PayPal, SEPA direct debit, bank transfer or generic card when visible
- All dates must be YYYY-MM-DD when possible
- Currency must be ISO 4217 like EUR or USD
- documentType must be one of: general, fuel, hospitality, lodging, parking, toll
- Return null when a field cannot be read confidently
- Add warnings when values are ambiguous or likely incomplete
- Always extract issuerName (document issuer/vendor) and recipientName (bill-to party) when visible
- Extract the issuer/vendor as supplier, never the bill-to recipient
- partyRole must be null when our company identity is not configured`;

export const EXTRACTION_JSON_SCHEMA = {
  type: "object" as const,
  properties: {
    supplier: { type: ["string", "null"] as const },
    partyRole: {
      type: ["string", "null"] as const,
      enum: ["CREDITOR", "DEBTOR", null],
    },
    issuerName: { type: ["string", "null"] as const },
    recipientName: { type: ["string", "null"] as const },
    issuerVatId: { type: ["string", "null"] as const },
    recipientVatId: { type: ["string", "null"] as const },
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
    "partyRole",
    "issuerName",
    "recipientName",
    "issuerVatId",
    "recipientVatId",
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

export class AiProviderError extends Error {
  public readonly code: string;
  public readonly userMessage: string;

  constructor(code: string, message: string, userMessage: string) {
    super(message);
    this.name = "AiProviderError";
    this.code = code;
    this.userMessage = userMessage;
  }
}

export function parseProviderError(error: unknown, provider: AiProvider): AiProviderError {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorString = JSON.stringify(error);

  if (errorMessage.includes("401") || errorMessage.includes("Unauthorized") || errorMessage.includes("invalid_api_key")) {
    return new AiProviderError(
      "invalid_api_key",
      errorMessage,
      `${AI_PROVIDERS[provider].name}: Ungültiger API-Key. Bitte überprüfen Sie Ihre Zugangsdaten.`
    );
  }

  if (errorMessage.includes("429") || errorMessage.includes("rate_limit") || errorMessage.includes("quota")) {
    return new AiProviderError(
      "rate_limit",
      errorMessage,
      `${AI_PROVIDERS[provider].name}: Rate-Limit erreicht. Bitte versuchen Sie es später erneut.`
    );
  }

  if (errorMessage.includes("insufficient_quota") || errorString.includes("insufficient_quota") || errorMessage.includes("billing")) {
    return new AiProviderError(
      "insufficient_quota",
      errorMessage,
      `${AI_PROVIDERS[provider].name}: Kein Guthaben mehr. Bitte laden Sie Ihr Konto auf.`
    );
  }

  if (errorMessage.includes("model_not_found") || errorMessage.includes("does not exist")) {
    return new AiProviderError(
      "model_not_found",
      errorMessage,
      `${AI_PROVIDERS[provider].name}: Das gewählte Modell ist nicht verfügbar.`
    );
  }

  if (errorMessage.includes("ECONNREFUSED") || errorMessage.includes("ENOTFOUND") || errorMessage.includes("network")) {
    return new AiProviderError(
      "network_error",
      errorMessage,
      `${AI_PROVIDERS[provider].name}: Verbindungsfehler. Bitte überprüfen Sie Ihre Internetverbindung.`
    );
  }

  return new AiProviderError(
    "unknown",
    errorMessage,
    `${AI_PROVIDERS[provider].name}: Ein unbekannter Fehler ist aufgetreten. ${errorMessage}`
  );
}
