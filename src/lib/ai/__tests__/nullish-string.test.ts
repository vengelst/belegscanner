import { describe, expect, it } from "vitest";
import { nullishToNull, sanitizeCountryCode } from "@/lib/ai/nullish-string";
import { normalizeExtractionResult } from "@/lib/ai/organization-prompt";
import type { ExtractionResult } from "@/lib/ai/types";

function base(overrides: Partial<ExtractionResult> = {}): ExtractionResult {
  return {
    supplier: "Mr. Wash Autoservice AG",
    partyRole: "CREDITOR",
    issuerName: "Mr. Wash Autoservice AG",
    recipientName: null,
    issuerVatId: null,
    recipientVatId: null,
    invoiceNumber: "90211070",
    invoiceDate: "2026-08-07",
    dueDate: null,
    serviceDate: null,
    time: null,
    currency: "EUR",
    grossAmount: 45,
    netAmount: 37.82,
    taxAmount: 7.18,
    paymentMethod: null,
    cardLastDigits: null,
    location: "null",
    countryCode: "null",
    countryName: "null",
    documentType: "general",
    lineItems: [],
    warnings: [],
    ...overrides,
  };
}

describe("nullishToNull", () => {
  it("wandelt Text-null in echtes null um", () => {
    expect(nullishToNull("null")).toBeNull();
    expect(nullishToNull("NULL")).toBeNull();
    expect(nullishToNull(" undefined ")).toBeNull();
    expect(nullishToNull("Berlin")).toBe("Berlin");
  });
});

describe("sanitizeCountryCode", () => {
  it("verwirft den Text null und behält ISO-Codes", () => {
    expect(sanitizeCountryCode("null")).toBeNull();
    expect(sanitizeCountryCode("de")).toBe("DE");
    expect(sanitizeCountryCode("Germany")).toBeNull();
  });
});

describe("normalizeExtractionResult nullish strings", () => {
  it("entfernt Text-null bei Ort und Land (Mr.-Wash-Fall)", () => {
    const result = normalizeExtractionResult(base(), null);

    expect(result.location).toBeNull();
    expect(result.countryCode).toBeNull();
    expect(result.countryName).toBeNull();
    expect(result.supplier).toBe("Mr. Wash Autoservice AG");
    expect(result.invoiceNumber).toBe("90211070");
  });
});
