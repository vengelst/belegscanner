/**
 * OCR service for receipt documents.
 *
 * Images are analyzed directly with Tesseract.js.
 * PDFs first try native text extraction; if the PDF does not contain usable text,
 * the first pages are rendered to images and passed through the same OCR flow.
 */

export type OcrSourceType = "image" | "pdf-text" | "pdf-scan" | "pdf-empty";

type OcrFieldConfidenceLevel = "high" | "medium" | "low" | "none";

export type OcrResult = {
  sourceType: OcrSourceType;
  rawText: string;
  extracted: {
    date: string | null;
    amount: number | null;
    currency: string | null;
    supplier: string | null;
  };
  confidence: number;
  fieldConfidence: {
    date: OcrFieldConfidenceLevel;
    amount: OcrFieldConfidenceLevel;
    currency: OcrFieldConfidenceLevel;
    supplier: OcrFieldConfidenceLevel;
  };
  message: string | null;
};

const EMPTY_RESULT: OcrResult = {
  sourceType: "pdf-empty",
  rawText: "",
  extracted: { date: null, amount: null, currency: null, supplier: null },
  confidence: 0,
  fieldConfidence: { date: "none", amount: "none", currency: "none", supplier: "none" },
  message: null,
};

const MAX_PDF_SCAN_PAGES = 3;

export async function analyzeDocument(
  buffer: Buffer,
  mimeType: string,
): Promise<OcrResult> {
  if (mimeType === "application/pdf") {
    return analyzePdf(buffer);
  }

  try {
    const imageResult = await recognizeImageText(buffer);
    return buildResult(imageResult.rawText, imageResult.confidence, "image");
  } catch (err) {
    console.error("OCR failed:", err);
    return {
      ...EMPTY_RESULT,
      sourceType: "image",
      message: "OCR konnte fuer diese Datei nicht ausgefuehrt werden. Bitte Felder manuell pruefen oder ergaenzen.",
    };
  }
}

async function analyzePdf(buffer: Buffer): Promise<OcrResult> {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: new Uint8Array(buffer) });

  try {
    const textResult = await parser.getText({
      pageJoiner: "\n\n",
      lineEnforce: true,
    });
    const extractedText = normalizeText(textResult.text);

    if (hasMeaningfulText(extractedText)) {
      return buildResult(extractedText, 0.92, "pdf-text");
    }

    const screenshotResult = await parser.getScreenshot({
      first: MAX_PDF_SCAN_PAGES,
      desiredWidth: 1800,
      imageDataUrl: false,
      imageBuffer: true,
    });

    const pageTexts: string[] = [];
    const confidences: number[] = [];

    for (const page of screenshotResult.pages) {
      const pageResult = await recognizeImageText(Buffer.from(page.data));
      const pageText = normalizeText(pageResult.rawText);
      if (pageText) pageTexts.push(pageText);
      confidences.push(pageResult.confidence);
    }

    const scanText = normalizeText(pageTexts.join("\n\n"));
    const scannedPageCount = screenshotResult.pages.length;
    const hasMorePages = textResult.total > scannedPageCount;

    if (hasMeaningfulText(scanText)) {
      const averageConfidence = confidences.length
        ? confidences.reduce((sum, current) => sum + current, 0) / confidences.length
        : 0;

      return {
        ...buildResult(scanText, averageConfidence, "pdf-scan"),
        message: hasMorePages
          ? `Scan-PDF ueber die ersten ${scannedPageCount} Seiten analysiert. Bitte Werte bei mehrseitigen Belegen pruefen.`
          : "Scan-PDF ueber Seitenbilder analysiert. Bitte Werte vor dem Speichern kurz pruefen.",
      };
    }

    return {
      ...EMPTY_RESULT,
      sourceType: "pdf-empty",
      message: hasMorePages
        ? `Im PDF wurde kein verwertbarer Text gefunden. Es wurden die ersten ${scannedPageCount} Seiten ohne brauchbares OCR-Ergebnis geprueft. Bitte Felder manuell ausfuellen.`
        : "Im PDF wurde kein verwertbarer Text gefunden. Bitte Felder manuell ausfuellen.",
    };
  } catch (err) {
    console.error("PDF OCR failed:", err);
    return {
      ...EMPTY_RESULT,
      sourceType: "pdf-empty",
      message: "PDF konnte nicht gelesen oder analysiert werden. Datei bleibt gespeichert; bitte Felder manuell erfassen.",
    };
  } finally {
    await parser.destroy().catch(() => undefined);
  }
}

async function recognizeImageText(buffer: Buffer): Promise<{ rawText: string; confidence: number }> {
  const Tesseract = await import("tesseract.js");
  const lang = process.env.OCR_LANGUAGE ?? "deu+eng";
  const { data } = await Tesseract.recognize(buffer, lang);

  return {
    rawText: normalizeText(data.text ?? ""),
    confidence: (data.confidence ?? 0) / 100,
  };
}

function buildResult(
  rawText: string,
  confidence: number,
  sourceType: OcrSourceType,
): OcrResult {
  const parsed = parseReceiptText(rawText);

  return {
    sourceType,
    rawText,
    extracted: {
      date: parsed.date.value,
      amount: parsed.amount.value,
      currency: parsed.currency.value,
      supplier: parsed.supplier.value,
    },
    confidence,
    fieldConfidence: {
      date: parsed.date.confidence,
      amount: parsed.amount.confidence,
      currency: parsed.currency.confidence,
      supplier: parsed.supplier.confidence,
    },
    message: null,
  };
}

// ============================================================
// Internal types and parsing
// ============================================================

type FieldResult<T> = { value: T | null; confidence: OcrFieldConfidenceLevel };

function normalizeText(text: string): string {
  return text
    .replace(/\u0000/g, "")
    .replace(/\r/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function hasMeaningfulText(text: string): boolean {
  if (!text) return false;
  const compact = text.replace(/\s/g, "");
  if (compact.length < 12) return false;
  return /[A-Za-z0-9]/.test(compact);
}

function parseReceiptText(text: string) {
  return {
    date: extractDate(text),
    amount: extractAmount(text),
    currency: extractCurrency(text),
    supplier: extractSupplier(text),
  };
}

function extractDate(text: string): FieldResult<string> {
  const kw = /(?:datum|date|rechnungsdatum|belegdatum)[:\s]*(\d{1,2})[./](\d{1,2})[./](20\d{2})/i;
  const kwMatch = text.match(kw);
  if (kwMatch) {
    const [, day, month, year] = kwMatch;
    return { value: `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`, confidence: "high" };
  }

  const euMatch = text.match(/(\d{1,2})[./](\d{1,2})[./](20\d{2})/);
  if (euMatch) {
    const [, day, month, year] = euMatch;
    const d = parseInt(day, 10);
    const m = parseInt(month, 10);
    if (d >= 1 && d <= 31 && m >= 1 && m <= 12) {
      return { value: `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`, confidence: "medium" };
    }
  }

  const isoMatch = text.match(/(20\d{2})-(\d{2})-(\d{2})/);
  if (isoMatch) return { value: isoMatch[0], confidence: "medium" };
  return { value: null, confidence: "none" };
}

function extractAmount(text: string): FieldResult<number> {
  const lines = text.split("\n");
  const totalKw = /(?:summe|gesamt|total|brutto|zu\s*zahlen|betrag|endbetrag|rechnungsbetrag)/i;

  for (const line of lines) {
    if (totalKw.test(line)) {
      const amount = parseAmountFromLine(line);
      if (amount !== null && amount > 0) return { value: amount, confidence: "high" };
    }
  }

  const all = extractAllAmounts(text);
  if (all.length > 0) {
    return {
      value: Math.max(...all),
      confidence: all.length === 1 ? "medium" : "low",
    };
  }

  return { value: null, confidence: "none" };
}

function parseAmountFromLine(line: string): number | null {
  const eu = line.match(/(\d{1,3}(?:\.\d{3})*,\d{2})/);
  if (eu) return parseFloat(eu[1].replace(/\./g, "").replace(",", "."));
  const us = line.match(/(\d+\.\d{2})/);
  if (us) return parseFloat(us[1]);
  return null;
}

function extractAllAmounts(text: string): number[] {
  const amounts: number[] = [];
  const euRegex = /(\d{1,3}(?:\.\d{3})*,\d{2})\b/g;
  let match: RegExpExecArray | null;
  while ((match = euRegex.exec(text)) !== null) {
    const value = parseFloat(match[1].replace(/\./g, "").replace(",", "."));
    if (!isNaN(value) && value > 0) amounts.push(value);
  }

  if (amounts.length === 0) {
    const usRegex = /(\d+\.\d{2})\b/g;
    while ((match = usRegex.exec(text)) !== null) {
      const value = parseFloat(match[1]);
      if (!isNaN(value) && value > 0) amounts.push(value);
    }
  }

  return amounts;
}

function extractCurrency(text: string): FieldResult<string> {
  const upper = text.toUpperCase();
  const explicit = text.match(/\d[,.]?\d{2}\s*(EUR|CHF|RSD|MKD|USD|GBP|CZK|HRK|PLN|HUF|RON|BGN|SEK|NOK|DKK)\b/i);
  if (explicit) return { value: explicit[1].toUpperCase(), confidence: "high" };
  if (upper.includes("EUR") || text.includes("?")) return { value: "EUR", confidence: "high" };
  if (upper.includes("CHF")) return { value: "CHF", confidence: "high" };
  if (upper.includes("RSD")) return { value: "RSD", confidence: "medium" };
  if (upper.includes("MKD")) return { value: "MKD", confidence: "medium" };
  if (upper.includes("USD") || text.includes("$")) return { value: "USD", confidence: "medium" };
  if (upper.includes("GBP") || text.includes("?")) return { value: "GBP", confidence: "medium" };
  return { value: null, confidence: "none" };
}

function extractSupplier(text: string): FieldResult<string> {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const noise = /^(tel|fax|mail|www|http|ust|steuer|mwst|netto|brutto|summe|datum|nr|kasse|bon|beleg)/i;

  for (const line of lines.slice(0, 7)) {
    if (noise.test(line)) continue;
    if (line.length < 3) continue;
    const alphaRatio = line.replace(/[^a-zA-Z???????]/g, "").length / line.length;
    if (alphaRatio < 0.3) continue;
    const clean = line.slice(0, 255);
    const hasUpper = /[A-Z???]{2,}/.test(clean);
    return { value: clean, confidence: hasUpper ? "high" : "medium" };
  }

  return { value: null, confidence: "none" };
}
