import { describe, expect, it } from "vitest";
import {
  decideTextMode,
  TEXT_MODE_MIN_CONFIDENCE,
  TEXT_MODE_MIN_LINES,
  TEXT_MODE_MIN_TEXT_LENGTH,
  type TextModeInput,
} from "@/lib/ocr-text-mode";

function ocr(overrides: Partial<TextModeInput> = {}): TextModeInput {
  return {
    text: "",
    confidence: 0.95,
    ...overrides,
  };
}

/** Beleg-aehnlicher Text mit genug Zeichen und Zeilen. */
function longReceiptText(withAmounts = true) {
  const lines = ["Muster Handel GmbH", "Musterstrasse 1, 12345 Musterstadt", "Rechnung 2026-0815"];
  for (let index = 1; index <= TEXT_MODE_MIN_LINES; index += 1) {
    lines.push(
      withAmounts
        ? `${index} Artikelbezeichnung mit etwas laengerem Namen   ${index},50`
        : `${index} Artikelbezeichnung mit etwas laengerem Namen   Stueck`,
    );
  }
  return lines.join("\n");
}

describe("decideTextMode", () => {
  it("erlaubt Text-Modus bei hoher Confidence, genug Text und Betraegen", () => {
    const decision = decideTextMode(ocr({ text: longReceiptText(), confidence: 0.92 }));

    expect(decision.useTextMode).toBe(true);
    expect(decision.hasAmountPattern).toBe(true);
    expect(decision.textLength).toBeGreaterThanOrEqual(TEXT_MODE_MIN_TEXT_LENGTH);
  });

  it("faellt auf Vision zurueck, wenn kein OCR-Ergebnis vorliegt", () => {
    const decision = decideTextMode(null);

    expect(decision.useTextMode).toBe(false);
    expect(decision.textLength).toBe(0);
  });

  it("faellt auf Vision zurueck, wenn der Text leer ist", () => {
    expect(decideTextMode(ocr({ text: "   \n  ", confidence: 0.99 })).useTextMode).toBe(false);
  });

  it("faellt auf Vision zurueck, wenn die Confidence unter dem Schwellwert liegt", () => {
    const decision = decideTextMode(
      ocr({ text: longReceiptText(), confidence: TEXT_MODE_MIN_CONFIDENCE - 0.05 }),
    );

    expect(decision.useTextMode).toBe(false);
    expect(decision.reason).toContain("Confidence");
  });

  it("reicht 0.6 Confidence nicht mehr aus (alte Schwelle war 0.5)", () => {
    expect(decideTextMode(ocr({ text: longReceiptText(), confidence: 0.6 })).useTextMode).toBe(false);
  });

  it("faellt auf Vision zurueck, wenn zu wenig Text und zu wenig Zeilen da sind", () => {
    const decision = decideTextMode(ocr({ text: "Kasse\nSumme 12,90", confidence: 0.99 }));

    expect(decision.useTextMode).toBe(false);
    expect(decision.reason).toContain("Zu wenig Text");
  });

  it("akzeptiert viele kurze Zeilen auch unter der Zeichengrenze", () => {
    const lines = Array.from({ length: TEXT_MODE_MIN_LINES + 2 }, (_, index) => `Pos ${index} 1,00`);
    const decision = decideTextMode(ocr({ text: lines.join("\n"), confidence: 0.9 }));

    expect(decision.textLength).toBeLessThan(TEXT_MODE_MIN_TEXT_LENGTH);
    expect(decision.lineCount).toBeGreaterThanOrEqual(TEXT_MODE_MIN_LINES);
    expect(decision.useTextMode).toBe(true);
  });

  it("faellt auf Vision zurueck, wenn kein Betragsmuster erkennbar ist", () => {
    const decision = decideTextMode(ocr({ text: longReceiptText(false), confidence: 0.99 }));

    expect(decision.hasAmountPattern).toBe(false);
    expect(decision.useTextMode).toBe(false);
    expect(decision.reason).toContain("Betragsmuster");
  });

  it("erkennt Betraege in verschiedenen Schreibweisen", () => {
    const variants = ["1.234,56", "12,90 EUR", "EUR 7,00", "€ 9.99", "9.99 USD"];
    for (const variant of variants) {
      const text = [...Array.from({ length: TEXT_MODE_MIN_LINES }, () => "Position ohne Zahl"), variant].join("\n");
      expect(decideTextMode(ocr({ text, confidence: 0.95 })).hasAmountPattern).toBe(true);
    }
  });

  it("zaehlt Leerzeilen nicht als Zeilen", () => {
    const decision = decideTextMode(ocr({ text: "Pos 1 1,00\n\n\nPos 2 2,00", confidence: 0.95 }));

    expect(decision.lineCount).toBe(2);
  });
});
