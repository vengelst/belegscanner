import { describe, it, expect } from "vitest";
import { checkSendReadiness } from "@/lib/validation";

const vollstaendigerBeleg = {
  date: "2025-01-15",
  amount: 42.5,
  currency: "EUR",
  supplier: "Tankstelle XY",
  invoiceNumber: "INV-2025-001",
  netAmount: 35.71,
  taxAmount: 6.79,
  countryId: "country-1",
  purposeId: "purpose-1",
  categoryId: "category-1",
  exchangeRate: null,
  hasFile: true,
  hasSmtp: true,
  hasDatev: true,
};

describe("checkSendReadiness", () => {
  it('gibt "sendbar" zurück bei vollständigem Beleg', () => {
    const result = checkSendReadiness(vollstaendigerBeleg);
    expect(result.status).toBe("sendbar");
    expect(result.issues).toHaveLength(0);
  });

  it('gibt "nicht_sendbar" zurück ohne Belegdatei', () => {
    const result = checkSendReadiness({
      ...vollstaendigerBeleg,
      hasFile: false,
    });
    expect(result.status).toBe("nicht_sendbar");
    expect(result.issues.some((i) => i.field === "file" && i.severity === "error")).toBe(true);
  });

  it('gibt "nicht_sendbar" zurück ohne SMTP-Konfiguration', () => {
    const result = checkSendReadiness({
      ...vollstaendigerBeleg,
      hasSmtp: false,
    });
    expect(result.status).toBe("nicht_sendbar");
    expect(result.issues.some((i) => i.field === "smtp" && i.severity === "error")).toBe(true);
  });

  it('gibt "nicht_sendbar" zurück ohne DATEV-Profil', () => {
    const result = checkSendReadiness({
      ...vollstaendigerBeleg,
      hasDatev: false,
    });
    expect(result.status).toBe("nicht_sendbar");
    expect(result.issues.some((i) => i.field === "datev" && i.severity === "error")).toBe(true);
  });

  it('gibt "pruefen" zurück ohne Land', () => {
    const result = checkSendReadiness({
      ...vollstaendigerBeleg,
      countryId: null,
    });
    expect(result.status).toBe("pruefen");
    expect(result.issues.some((i) => i.field === "countryId" && i.severity === "warning")).toBe(true);
  });

  it('gibt "pruefen" zurück ohne Lieferant', () => {
    const result = checkSendReadiness({
      ...vollstaendigerBeleg,
      supplier: null,
    });
    expect(result.status).toBe("pruefen");
    expect(result.issues.some((i) => i.field === "supplier" && i.severity === "warning")).toBe(true);
  });

  it('gibt "pruefen" zurück ohne Rechnungsnummer', () => {
    const result = checkSendReadiness({
      ...vollstaendigerBeleg,
      invoiceNumber: null,
    });
    expect(result.status).toBe("pruefen");
    expect(result.issues.some((i) => i.field === "invoiceNumber" && i.severity === "warning")).toBe(true);
  });

  it('gibt "pruefen" zurück bei Fremdwährung ohne Wechselkurs', () => {
    const result = checkSendReadiness({
      ...vollstaendigerBeleg,
      currency: "USD",
      exchangeRate: null,
    });
    expect(result.status).toBe("pruefen");
    expect(result.issues.some((i) => i.field === "exchangeRate" && i.severity === "warning")).toBe(true);
  });

  it('"error" hat Vorrang vor "warning" → Status wird "nicht_sendbar"', () => {
    const result = checkSendReadiness({
      ...vollstaendigerBeleg,
      hasFile: false,
      countryId: null,
    });
    expect(result.status).toBe("nicht_sendbar");
    expect(result.issues.some((i) => i.severity === "error")).toBe(true);
    expect(result.issues.some((i) => i.severity === "warning")).toBe(true);
  });

  it("sammelt mehrere Warnungen korrekt", () => {
    const result = checkSendReadiness({
      ...vollstaendigerBeleg,
      countryId: null,
      supplier: null,
      netAmount: null,
      taxAmount: null,
    });
    expect(result.status).toBe("pruefen");
    expect(result.issues.filter((i) => i.severity === "warning").length).toBeGreaterThanOrEqual(4);
  });

  it('gibt "pruefen" zurück ohne Datum', () => {
    const result = checkSendReadiness({
      ...vollstaendigerBeleg,
      date: null,
    });
    expect(result.status).toBe("pruefen");
    expect(result.issues.some((i) => i.field === "date")).toBe(true);
  });

  it('gibt "pruefen" zurück bei Betrag 0', () => {
    const result = checkSendReadiness({
      ...vollstaendigerBeleg,
      amount: 0,
    });
    expect(result.status).toBe("pruefen");
    expect(result.issues.some((i) => i.field === "amount")).toBe(true);
  });
});
