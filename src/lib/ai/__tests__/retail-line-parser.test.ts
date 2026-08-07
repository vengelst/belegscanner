import { describe, expect, it } from "vitest";
import {
  parseRetailReceiptLines,
  preferRetailLinesIfBetter,
} from "@/lib/ai/retail-line-parser";

const ROSSMANN_OCR = `
ROSSMANN
Mein Drogeriemarkt
4305615941394 ISANA MEN RASIERGE €0,40 A
4305615614045 ISANA MEN PACE 6+ €8,99*A
4305615613932 ISANA MEN PACE 6+ €5,99 A
2101514002073 SOFORTDRUCK CEWE €2,07 A
Summe €17,45
MWST Gruppe A 19%
Mastercard €17,45
`;

describe("parseRetailReceiptLines", () => {
  it("liest Rossmann-Positionen mit korrekten Preisen", () => {
    const lines = parseRetailReceiptLines(ROSSMANN_OCR);

    expect(lines).toHaveLength(4);
    expect(lines.map((line) => line.totalPrice)).toEqual([0.4, 8.99, 5.99, 2.07]);
    expect(lines[0].description).toContain("RASIERGE");
    expect(lines[0].description).toContain("4305615941394");
    expect(lines[3].description).toContain("CEWE");
    expect(lines[1].taxHint).toBe("A");
  });
});

describe("preferRetailLinesIfBetter", () => {
  it("ersetzt verrutschte KI-Preise durch OCR-Zeilen", () => {
    const aiItems = [
      { description: "ISANA MEN RASIERGE", quantity: null, unit: null, unitPrice: null, totalPrice: 8.99, taxHint: null },
      { description: "ISANA MEN PACE 6+", quantity: null, unit: null, unitPrice: null, totalPrice: 5.99, taxHint: null },
      { description: "ISANA MEN PACE 6+", quantity: null, unit: null, unitPrice: null, totalPrice: 2.07, taxHint: null },
      { description: "SOFORTDRUCK CEWE", quantity: null, unit: null, unitPrice: null, totalPrice: null, taxHint: null },
    ];

    const result = preferRetailLinesIfBetter(aiItems, ROSSMANN_OCR, 17.45);

    expect(result.usedRetail).toBe(true);
    expect(result.items.map((item) => item.totalPrice)).toEqual([0.4, 8.99, 5.99, 2.07]);
  });
});
