/**
 * Hybrid-Gate: entscheidet, ob der reine OCR-Text fuer die KI-Auslese reicht
 * oder ob der Vision-Pfad mit Bild noetig ist.
 *
 * Der Text-Modus ist billig und schnell, verliert aber genau die Informationen,
 * die bei kleiner Schrift ohnehin schon wackelig sind: einzelne Positionszeilen
 * in Tabellen. Eine hohe Confidence allein reicht deshalb nicht - der Text muss
 * auch substanziell sein und erkennbar Betraege enthalten. Sonst sieht das
 * Modell das Bild selbst.
 *
 * Bewusst ohne Abhaengigkeiten, damit die Regel isoliert testbar bleibt.
 */

export const TEXT_MODE_MIN_CONFIDENCE = 0.85;
export const TEXT_MODE_MIN_TEXT_LENGTH = 600;
export const TEXT_MODE_MIN_LINES = 16;

/** Betragsmuster wie "1.234,56", "12,90 EUR" oder "€ 9.99". */
const AMOUNT_PATTERN = /(?:€|EUR|CHF|USD)\s*-?\d|\d{1,3}(?:[.\s]\d{3})*[.,]\d{2}(?!\d)/i;

export type TextModeInput = {
  text: string;
  confidence: number;
};

export type TextModeDecision = {
  useTextMode: boolean;
  /** Klartext-Begruendung fuer das Logging. */
  reason: string;
  confidence: number;
  textLength: number;
  lineCount: number;
  hasAmountPattern: boolean;
};

export function decideTextMode(ocrResult: TextModeInput | null): TextModeDecision {
  if (!ocrResult) {
    return {
      useTextMode: false,
      reason: "OCR-Service lieferte kein Ergebnis",
      confidence: 0,
      textLength: 0,
      lineCount: 0,
      hasAmountPattern: false,
    };
  }

  const text = ocrResult.text.trim();
  const lineCount = text.length === 0
    ? 0
    : text.split(/\r?\n/).filter((line) => line.trim().length > 0).length;
  const hasAmountPattern = AMOUNT_PATTERN.test(text);
  const base = {
    confidence: ocrResult.confidence,
    textLength: text.length,
    lineCount,
    hasAmountPattern,
  };

  if (text.length === 0) {
    return { ...base, useTextMode: false, reason: "OCR-Text ist leer" };
  }
  if (ocrResult.confidence < TEXT_MODE_MIN_CONFIDENCE) {
    return {
      ...base,
      useTextMode: false,
      reason: `Confidence ${ocrResult.confidence.toFixed(2)} < ${TEXT_MODE_MIN_CONFIDENCE}`,
    };
  }
  // Beides noetig: nur Zeichen ODER nur Zeilen reichen nicht fuer zuverlaessige
  // Positions-Zuordnung (Text oft ohne Tabellenlayout).
  if (text.length < TEXT_MODE_MIN_TEXT_LENGTH || lineCount < TEXT_MODE_MIN_LINES) {
    return {
      ...base,
      useTextMode: false,
      reason: `Zu wenig Text (${text.length} Zeichen, ${lineCount} Zeilen) - Positionen koennten fehlen`,
    };
  }
  if (!hasAmountPattern) {
    return { ...base, useTextMode: false, reason: "Kein Betragsmuster im OCR-Text gefunden" };
  }

  return { ...base, useTextMode: true, reason: "Confidence, Textmenge und Betraege ausreichend" };
}
