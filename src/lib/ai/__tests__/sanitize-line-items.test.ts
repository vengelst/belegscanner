import { describe, expect, it } from "vitest";
import { preferRetailDescription, sanitizeLineItems } from "@/lib/ai/sanitize-line-items";

function item(overrides: Partial<{
  description: string;
  quantity: number | null;
  unit: string | null;
  unitPrice: number | null;
  totalPrice: number | null;
  taxHint: string | null;
}> = {}) {
  return {
    description: "Artikel A",
    quantity: 1 as number | null,
    unit: "Stk" as string | null,
    unitPrice: 10 as number | null,
    totalPrice: 10 as number | null,
    taxHint: null as string | null,
    ...overrides,
  };
}

describe("preferRetailDescription", () => {
  it("formatiert EAN + Name lesbar und eindeutig", () => {
    expect(preferRetailDescription("4305615614045 ISANA MEN PACE 6+")).toBe(
      "ISANA MEN PACE 6+ (4305615614045)",
    );
  });
});

describe("sanitizeLineItems", () => {
  it("verwirft Summenzeilen", () => {
    const warnings: string[] = [];
    const result = sanitizeLineItems(
      [
        item(),
        {
          description: "Summe",
          quantity: null,
          unit: null,
          unitPrice: null,
          totalPrice: 119,
          taxHint: null,
        },
      ],
      119,
      warnings,
    );

    expect(result).toHaveLength(1);
    expect(result[0].description).toBe("Artikel A");
    expect(warnings.some((warning) => /Summen/.test(warning))).toBe(true);
  });

  it("leert Positionspreise die dem Beleg-Gesamtbetrag entsprechen", () => {
    const warnings: string[] = [];
    const result = sanitizeLineItems(
      [
        item({ description: "Pos 1", totalPrice: 40, unitPrice: 40 }),
        item({ description: "Pos 2", totalPrice: 119, unitPrice: 119, quantity: 1 }),
      ],
      119,
      warnings,
    );

    expect(result[0].totalPrice).toBe(40);
    expect(result[1].totalPrice).toBeNull();
    expect(warnings.some((warning) => /Gesamtbetrag/.test(warning))).toBe(true);
  });

  it("korrigiert totalPrice auf Menge × Einzelpreis", () => {
    const warnings: string[] = [];
    const result = sanitizeLineItems(
      [item({ quantity: 2, unitPrice: 12.5, totalPrice: 99 })],
      25,
      warnings,
    );

    expect(result[0].totalPrice).toBe(25);
    expect(warnings.some((warning) => /korrigiert/.test(warning))).toBe(true);
  });

  it("haelt Rossmann-Positionen mit gleichem Namen getrennt und prueft die Summe", () => {
    const warnings: string[] = [];
    const result = sanitizeLineItems(
      [
        item({
          description: "4305615941394 ISANA MEN RASIERGE",
          quantity: null,
          unitPrice: null,
          totalPrice: 0.4,
          taxHint: "A",
        }),
        item({
          description: "4305615614045 ISANA MEN PACE 6+",
          quantity: null,
          unitPrice: null,
          totalPrice: 8.99,
          taxHint: "*A",
        }),
        item({
          description: "4305615613932 ISANA MEN PACE 6+",
          quantity: null,
          unitPrice: null,
          totalPrice: 5.99,
          taxHint: "A",
        }),
        item({
          description: "2101514002073 SOFORTDRUCK CEWE",
          quantity: null,
          unitPrice: null,
          totalPrice: 2.07,
          taxHint: "A",
        }),
      ],
      17.45,
      warnings,
    );

    expect(result).toHaveLength(4);
    expect(result[1].description).toContain("4305615614045");
    expect(result[2].description).toContain("4305615613932");
    expect(result[1].description).not.toBe(result[2].description);
    expect(result.map((entry) => entry.totalPrice)).toEqual([0.4, 8.99, 5.99, 2.07]);
    expect(result[1].taxHint).toBe("A");
    expect(warnings.some((warning) => /weicht/.test(warning))).toBe(false);
  });

  it("verwirft MWST- und Mastercard-Zeilen", () => {
    const warnings: string[] = [];
    const result = sanitizeLineItems(
      [
        item({ description: "ISANA MEN RASIERGE", totalPrice: 0.4, unitPrice: null, quantity: null }),
        item({ description: "MWST Gruppe A 19%", totalPrice: 2.79, unitPrice: null, quantity: null }),
        item({ description: "Mastercard", totalPrice: 17.45, unitPrice: null, quantity: null }),
      ],
      17.45,
      warnings,
    );

    expect(result).toHaveLength(1);
    expect(result[0].description).toContain("ISANA");
  });
});
