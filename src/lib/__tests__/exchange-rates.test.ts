import { describe, it, expect } from "vitest";
import { calculateAmountEur } from "@/lib/exchange-rates";

describe("calculateAmountEur", () => {
  it("gibt den Betrag direkt zurück wenn Währung EUR ist", () => {
    expect(calculateAmountEur(100, "EUR", null)).toBe(100);
    expect(calculateAmountEur(49.99, "eur", null)).toBe(49.99);
    expect(calculateAmountEur(49.99, " EUR ", null)).toBe(49.99);
  });

  it("rechnet Fremdwährung korrekt mit Kurs um (Division)", () => {
    // 100 USD / 1.1 = 90.909... → gerundet 90.91
    expect(calculateAmountEur(100, "USD", 1.1)).toBe(90.91);
  });

  it("rundet auf 2 Dezimalstellen", () => {
    // 33.33 / 1.5 = 22.22
    expect(calculateAmountEur(33.33, "USD", 1.5)).toBe(22.22);
    // 10 / 3 = 3.3333... → 3.33
    expect(calculateAmountEur(10, "GBP", 3)).toBe(3.33);
    // 7 / 3 = 2.3333... → 2.33
    expect(calculateAmountEur(7, "GBP", 3)).toBe(2.33);
  });

  it("gibt den Betrag direkt zurück wenn Kurs null ist (Fallback)", () => {
    expect(calculateAmountEur(50, "USD", null)).toBe(50);
  });

  it("gibt den Betrag direkt zurück wenn Kurs 0 ist (Fallback)", () => {
    expect(calculateAmountEur(50, "USD", 0)).toBe(50);
  });

  it("gibt den Betrag direkt zurück wenn Kurs negativ ist (Fallback)", () => {
    expect(calculateAmountEur(50, "CHF", -1.5)).toBe(50);
  });

  it("behandelt Betrag 0 korrekt", () => {
    expect(calculateAmountEur(0, "EUR", null)).toBe(0);
    expect(calculateAmountEur(0, "USD", 1.1)).toBe(0);
  });
});
