import { describe, it, expect } from "vitest";
import { receiptSchema, loginSchema, sendReadySchema } from "@/lib/validation";

// ============================================================
// loginSchema
// ============================================================

describe("loginSchema", () => {
  it("akzeptiert gültige Anmeldedaten", () => {
    const result = loginSchema.safeParse({
      email: "user@example.com",
      password: "sicheres-passwort",
    });
    expect(result.success).toBe(true);
  });

  it("lehnt ungültige E-Mail ab", () => {
    const result = loginSchema.safeParse({
      email: "keine-email",
      password: "sicheres-passwort",
    });
    expect(result.success).toBe(false);
  });

  it("lehnt leere E-Mail ab", () => {
    const result = loginSchema.safeParse({
      email: "",
      password: "sicheres-passwort",
    });
    expect(result.success).toBe(false);
  });

  it("lehnt Passwort mit weniger als 8 Zeichen ab", () => {
    const result = loginSchema.safeParse({
      email: "user@example.com",
      password: "kurz",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain("8 Zeichen");
    }
  });

  it("akzeptiert Passwort mit genau 8 Zeichen", () => {
    const result = loginSchema.safeParse({
      email: "user@example.com",
      password: "12345678",
    });
    expect(result.success).toBe(true);
  });
});

// ============================================================
// receiptSchema
// ============================================================

describe("receiptSchema", () => {
  const validReceipt = {
    date: "2025-01-15",
    amount: 42.5,
    currency: "EUR",
    purposeId: "purpose-1",
    categoryId: "category-1",
  };

  it("akzeptiert ein vollständig gültiges Objekt", () => {
    const result = receiptSchema.safeParse(validReceipt);
    expect(result.success).toBe(true);
  });

  it("akzeptiert ein Objekt mit optionalen Feldern", () => {
    const result = receiptSchema.safeParse({
      ...validReceipt,
      supplier: "Tankstelle XY",
      invoiceNumber: "INV-2025-001",
      countryId: "country-1",
      vehicleId: "vehicle-1",
      remark: "Testbemerkung",
    });
    expect(result.success).toBe(true);
  });

  it("scheitert wenn purposeId fehlt", () => {
    const { purposeId: _, ...withoutPurpose } = validReceipt;
    const result = receiptSchema.safeParse(withoutPurpose);
    expect(result.success).toBe(false);
  });

  it("scheitert wenn categoryId fehlt", () => {
    const { categoryId: _, ...withoutCategory } = validReceipt;
    const result = receiptSchema.safeParse(withoutCategory);
    expect(result.success).toBe(false);
  });

  it("scheitert bei negativem Betrag", () => {
    const result = receiptSchema.safeParse({
      ...validReceipt,
      amount: -10,
    });
    expect(result.success).toBe(false);
  });

  it("scheitert bei Betrag 0", () => {
    const result = receiptSchema.safeParse({
      ...validReceipt,
      amount: 0,
    });
    expect(result.success).toBe(false);
  });

  it("scheitert bei ungültigem Datum", () => {
    const result = receiptSchema.safeParse({
      ...validReceipt,
      date: "kein-datum",
    });
    expect(result.success).toBe(false);
  });

  it("scheitert bei fehlendem Datum", () => {
    const { date: _, ...withoutDate } = validReceipt;
    const result = receiptSchema.safeParse(withoutDate);
    expect(result.success).toBe(false);
  });
});

// ============================================================
// sendReadySchema
// ============================================================

describe("sendReadySchema", () => {
  const validSendReady = {
    date: "2025-01-15",
    amount: 42.5,
    currency: "EUR",
    countryId: "country-1",
    purposeId: "purpose-1",
    categoryId: "category-1",
  };

  it("akzeptiert ein gültiges Versand-Objekt", () => {
    const result = sendReadySchema.safeParse(validSendReady);
    expect(result.success).toBe(true);
  });

  it("erfordert countryId (nicht optional wie bei receiptSchema)", () => {
    const result = sendReadySchema.safeParse({
      ...validSendReady,
      countryId: "",
    });
    expect(result.success).toBe(false);
  });

  it("verlangt exchangeRate bei Fremdwährung", () => {
    const result = sendReadySchema.safeParse({
      ...validSendReady,
      currency: "USD",
      exchangeRate: null,
      exchangeRateDate: null,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message);
      expect(messages).toContain("Wechselkurs ist bei Fremdwaehrung erforderlich.");
    }
  });

  it("verlangt exchangeRateDate bei Fremdwährung", () => {
    const result = sendReadySchema.safeParse({
      ...validSendReady,
      currency: "USD",
      exchangeRate: 1.1,
      exchangeRateDate: null,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message);
      expect(messages).toContain("Kursdatum ist bei Fremdwaehrung erforderlich.");
    }
  });

  it("akzeptiert Fremdwährung mit Kurs und Kursdatum", () => {
    const result = sendReadySchema.safeParse({
      ...validSendReady,
      currency: "USD",
      exchangeRate: 1.1,
      exchangeRateDate: "2025-01-15",
    });
    expect(result.success).toBe(true);
  });

  it("erfordert keine exchangeRate bei EUR", () => {
    const result = sendReadySchema.safeParse(validSendReady);
    expect(result.success).toBe(true);
  });
});
