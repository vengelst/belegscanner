/**
 * Parst deutsche Kassenbon-Zeilen (EAN + Name + Preis) aus OCR-Rohtext.
 * Die KI verrutscht Preise oft um eine Zeile; der Zeilenparser haelt
 * Beschreibung und Preis aus derselben Textzeile zusammen.
 */

export type RetailParsedLine = {
  description: string;
  quantity: number | null;
  unit: string | null;
  unitPrice: number | null;
  totalPrice: number;
  taxHint: string | null;
};

const RETAIL_LINE =
  /^(\d{8,14})\s*(.+?)\s+[€$]?\s*(-?\d{1,5}[.,]\d{2})\s*\*?([A-Za-z])?\s*$/;

function parseAmount(raw: string): number | null {
  const normalized = raw.replace(/\s/g, "").replace(",", ".");
  const value = Number.parseFloat(normalized);
  return Number.isFinite(value) ? Math.round(value * 100) / 100 : null;
}

function nearlyEqual(a: number, b: number, tolerance = 0.05): boolean {
  return Math.abs(a - b) <= Math.max(tolerance, Math.abs(b) * 0.005);
}

function normalizeOcrLines(ocrText: string): string[] {
  const raw = ocrText
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const merged: string[] = [];
  for (let index = 0; index < raw.length; index += 1) {
    const current = raw[index];
    const next = raw[index + 1];
    // OCR trennt manchmal EAN und Name/Preis auf zwei Zeilen.
    if (/^\d{8,14}$/.test(current) && next) {
      merged.push(`${current} ${next}`);
      index += 1;
      continue;
    }
    merged.push(current);
  }
  return merged;
}

export function parseRetailReceiptLines(ocrText: string | null | undefined): RetailParsedLine[] {
  if (!ocrText?.trim()) return [];

  const lines: RetailParsedLine[] = [];
  for (const line of normalizeOcrLines(ocrText)) {
    const match = line.match(RETAIL_LINE);
    if (!match) continue;

    const ean = match[1];
    const name = match[2].trim();
    const amount = parseAmount(match[3]);
    if (amount == null || amount <= 0) continue;
    if (/^(summe|total|mwst|netto|brutto)/i.test(name)) continue;

    lines.push({
      description: `${name} (${ean})`.slice(0, 180),
      quantity: null,
      unit: null,
      unitPrice: null,
      totalPrice: amount,
      taxHint: match[4] ? match[4].toUpperCase() : null,
    });
  }

  return lines;
}

export function sumRetailLinePrices(items: Array<{ totalPrice: number | null }>): number | null {
  const amounts = items
    .map((item) => item.totalPrice)
    .filter((value): value is number => value !== null && Number.isFinite(value));
  if (amounts.length === 0) return null;
  return Math.round(amounts.reduce((sum, value) => sum + value, 0) * 100) / 100;
}

/**
 * Ersetzt KI-Positionen durch OCR-Kassenzeilen, wenn deren Summe besser zum
 * Beleg-Brutto passt (typischer Preis-Versatz um eine Zeile).
 */
export function preferRetailLinesIfBetter<T extends {
  description: string;
  quantity: number | null;
  unit: string | null;
  unitPrice: number | null;
  totalPrice: number | null;
  taxHint: string | null;
}>(
  aiItems: T[],
  ocrText: string | null | undefined,
  grossAmount: number | null,
): { items: Array<T | RetailParsedLine>; usedRetail: boolean; reason: string | null } {
  const retail = parseRetailReceiptLines(ocrText);
  if (retail.length < 2) {
    return { items: aiItems, usedRetail: false, reason: null };
  }

  const retailSum = sumRetailLinePrices(retail);
  const aiSum = sumRetailLinePrices(aiItems);
  if (retailSum == null) {
    return { items: aiItems, usedRetail: false, reason: null };
  }

  const retailMatchesGross = grossAmount != null && nearlyEqual(retailSum, grossAmount);
  const aiMatchesGross = grossAmount != null && aiSum != null && nearlyEqual(aiSum, grossAmount);
  const aiHasMissingPrice = aiItems.some((item) => item.totalPrice == null);
  const aiWorse =
    grossAmount != null
    && aiSum != null
    && Math.abs(aiSum - grossAmount) > Math.abs(retailSum - grossAmount) + 0.02;

  if (retailMatchesGross && (!aiMatchesGross || aiHasMissingPrice || aiWorse)) {
    return {
      items: retail,
      usedRetail: true,
      reason: `Kassenbon-Zeilen aus OCR verwendet (Summe ${retailSum.toFixed(2)} = Beleg ${grossAmount?.toFixed(2)}).`,
    };
  }

  // Auch ohne Brutto: wenn die KI Preise fehlen oder weniger Zeilen hat.
  if ((aiHasMissingPrice || aiItems.length < retail.length) && retail.length >= 2) {
    return {
      items: retail,
      usedRetail: true,
      reason: `Kassenbon-Zeilen aus OCR verwendet (${retail.length} Positionen, KI unvollstaendig).`,
    };
  }

  return { items: aiItems, usedRetail: false, reason: null };
}
