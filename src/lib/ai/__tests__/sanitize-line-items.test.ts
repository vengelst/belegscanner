import { describe, expect, it } from "vitest";
import { sanitizeLineItems } from "@/lib/ai/sanitize-line-items";

function item(overrides: Partial<ReturnType<typeof base>> = {}) {
  return { ...base(), ...overrides };
}

function base() {
  return {
    description: "Artikel A",
    quantity: 1,
    unit: "Stk",
    unitPrice: 10,
    totalPrice: 10,
    taxHint: null as string | null,
  };
}

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
});
