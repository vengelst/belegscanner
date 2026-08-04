import { describe, expect, it } from "vitest";
import type { ExtractionResult } from "@/lib/ai/types";
import {
  buildSystemPrompt,
  normalizeExtractionResult,
  normalizePartyRole,
} from "@/lib/ai/organization-prompt";
import type { OrganizationIdentity } from "@/lib/organization";
import { matchesOrganization, namesLikelyMatch } from "@/lib/organization";

const VIVAHOME: OrganizationIdentity = {
  legalName: "Vivahome GmbH",
  tradeName: "Viva Home",
  vatId: "DE123456789",
  street: "Beispielweg 1",
  zip: "12345",
  city: "Berlin",
  countryCode: "DE",
};

function baseExtraction(overrides: Partial<ExtractionResult> = {}): ExtractionResult {
  return {
    supplier: null,
    partyRole: null,
    issuerName: null,
    recipientName: null,
    invoiceNumber: "RE-40000059",
    invoiceDate: "2026-07-01",
    dueDate: null,
    serviceDate: null,
    time: null,
    currency: "EUR",
    grossAmount: 100,
    netAmount: 84.03,
    taxAmount: 15.97,
    paymentMethod: null,
    cardLastDigits: null,
    location: null,
    countryCode: "DE",
    countryName: "Deutschland",
    documentType: "general",
    lineItems: [],
    warnings: [],
    ...overrides,
  };
}

describe("organization name matching", () => {
  it("erkennt Vivahome Varianten fuzzy", () => {
    expect(namesLikelyMatch("Vivahome GmbH", "Viva Home")).toBe(true);
    expect(namesLikelyMatch("Vivahome GmbH", "Securiton GmbH")).toBe(false);
    expect(matchesOrganization(VIVAHOME, "VIVA HOME GmbH")).toBe(true);
    expect(matchesOrganization(VIVAHOME, "Fremde Firma", "DE123456789")).toBe(true);
  });
});

describe("normalizePartyRole", () => {
  it("normalisiert gueltige Werte", () => {
    expect(normalizePartyRole("DEBTOR")).toBe("DEBTOR");
    expect(normalizePartyRole("creditor")).toBe("CREDITOR");
    expect(normalizePartyRole("unknown")).toBeNull();
    expect(normalizePartyRole(null)).toBeNull();
  });
});

describe("buildSystemPrompt", () => {
  it("nutzt Legacy-Regel ohne Firmenstammdaten", () => {
    const prompt = buildSystemPrompt(null);
    expect(prompt).toContain("issuer/vendor as supplier");
    expect(prompt).not.toContain("Our company identity");
  });

  it("fuegt Firmenidentitaet und Debitoren-Regeln hinzu", () => {
    const prompt = buildSystemPrompt(VIVAHOME);
    expect(prompt).toContain("Our company identity");
    expect(prompt).toContain("Vivahome GmbH");
    expect(prompt).toContain('partyRole = "DEBTOR"');
    expect(prompt).toContain("bill-to recipient");
  });
});

describe("normalizeExtractionResult", () => {
  it("laesst Legacy-Verhalten ohne Firma unveraendert (supplier=issuer, partyRole null)", () => {
    const result = normalizeExtractionResult(
      baseExtraction({
        supplier: "REWE Markt GmbH",
        issuerName: "REWE Markt GmbH",
        recipientName: "Vivahome GmbH",
        partyRole: "CREDITOR",
      }),
      null,
    );

    expect(result.partyRole).toBeNull();
    expect(result.supplier).toBe("REWE Markt GmbH");
  });

  it("setzt Debitorenrechnung: Aussteller = eigene Firma -> supplier = Kunde", () => {
    const result = normalizeExtractionResult(
      baseExtraction({
        supplier: "Vivahome GmbH",
        issuerName: "Viva Home",
        recipientName: "Securiton GmbH",
        partyRole: "CREDITOR",
      }),
      VIVAHOME,
    );

    expect(result.partyRole).toBe("DEBTOR");
    expect(result.supplier).toBe("Securiton GmbH");
  });

  it("setzt Kreditorenrechnung: fremder Aussteller -> supplier = Lieferant", () => {
    const result = normalizeExtractionResult(
      baseExtraction({
        supplier: "Tankstelle Shell",
        issuerName: "Shell Deutschland GmbH",
        recipientName: "Vivahome GmbH",
        partyRole: null,
      }),
      VIVAHOME,
    );

    expect(result.partyRole).toBe("CREDITOR");
    expect(result.supplier).toBe("Shell Deutschland GmbH");
  });

  it("korrigiert Debitor wenn AI partyRole=DEBTOR aber supplier=eigene Firma", () => {
    const result = normalizeExtractionResult(
      baseExtraction({
        supplier: "Vivahome GmbH",
        issuerName: "Vivahome GmbH",
        recipientName: "Securiton AG",
        partyRole: "DEBTOR",
      }),
      VIVAHOME,
    );

    expect(result.partyRole).toBe("DEBTOR");
    expect(result.supplier).toBe("Securiton AG");
  });

  it("fuegt Warning hinzu wenn Debitor erkannt aber Empfaenger fehlt", () => {
    const result = normalizeExtractionResult(
      baseExtraction({
        supplier: "Vivahome GmbH",
        issuerName: "Vivahome GmbH",
        recipientName: null,
        partyRole: null,
      }),
      VIVAHOME,
    );

    expect(result.partyRole).toBe("DEBTOR");
    expect(result.supplier).toBeNull();
    expect(result.warnings.some((w) => /Kundenname/i.test(w))).toBe(true);
  });
});
