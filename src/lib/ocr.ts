/**
 * Robuste Betragslogik fuer die OCR-/KI-Auslese (P0-3).
 *
 * Zwei Kernprobleme werden hier deterministisch geloest:
 *
 * 1. Zahlformate: EU ("1.234,56"), US ("1,234.56"), reine Tausenderpunkte
 *    ("1.234" -> 1234) vs. Dezimalpunkt ("12.50" -> 12.5) werden korrekt
 *    unterschieden.
 * 2. Betragsrolle: Der Gesamtbetrag (Rechnungs-/Zahlbetrag/Brutto) wird gegenueber
 *    einer Zwischensumme bevorzugt; eine Zwischensumme wird nie als finaler
 *    Gesamtbetrag verwendet.
 *
 * Die Funktionen sind bewusst rein (keine Seiteneffekte, keine Cloud-Calls) und
 * werden von der Analyse-Pipeline als Korrektur-/Fallback-Schicht ueber der
 * OpenAI-Strukturierung genutzt.
 */

export type ExtractedAmounts = {
  grossAmount: number | null;
  netAmount: number | null;
  taxAmount: number | null;
  /** Betrag, der eindeutig als Zwischensumme erkannt wurde (nie = grossAmount). */
  subtotalAmount: number | null;
};

export type AmountReconciliation = {
  grossAmount: number | null;
  netAmount: number | null;
  taxAmount: number | null;
  /** Kurzbegruendung, falls ein Wert korrigiert wurde (fuer Logging/Warnungen). */
  corrections: string[];
};

// Ein Zahl-Token: Ziffern mit optionalen '.'/',' Gruppierungen, optionalem Vorzeichen.
const NUMBER_TOKEN = /-?\d{1,3}(?:[.,\s]\d{3})*(?:[.,]\d+)?|-?\d+(?:[.,]\d+)?/g;

/**
 * Parst einen einzelnen Betrags-String robust nach EU-/US-Konventionen.
 *
 * Beispiele:
 *  - "1.234,56"  -> 1234.56  (EU)
 *  - "1,234.56"  -> 1234.56  (US)
 *  - "1.234"     -> 1234     (Tausenderpunkt, 3 Nachkommastellen ohne Komma)
 *  - "12.50"     -> 12.5     (Dezimalpunkt)
 *  - "0.500"     -> 0.5      (fuehrende 0 => Dezimal, kein Tausender)
 *  - "12,50"     -> 12.5     (EU-Dezimalkomma)
 *  - "1.234.567,89" -> 1234567.89
 */
export function parseAmountValue(raw: string | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;

  // Nur Ziffern, Trenner und Vorzeichen behalten (Waehrungssymbole/Text raus).
  const cleaned = String(raw)
    .replace(/[\u00A0\u202F\u2009]/g, " ") // diverse Leerzeichen normalisieren
    .replace(/[^0-9.,\-]/g, "")
    .trim();

  if (cleaned === "" || cleaned === "-" || cleaned === "." || cleaned === ",") {
    return null;
  }

  const negative = cleaned.startsWith("-");
  const body = cleaned.replace(/-/g, "");

  const hasDot = body.includes(".");
  const hasComma = body.includes(",");

  let normalized: string;

  if (hasDot && hasComma) {
    // Der zuletzt auftretende Trenner ist das Dezimalzeichen.
    const lastDot = body.lastIndexOf(".");
    const lastComma = body.lastIndexOf(",");
    const decimalSep = lastDot > lastComma ? "." : ",";
    const thousandsSep = decimalSep === "." ? "," : ".";
    normalized = body
      .split(thousandsSep)
      .join("")
      .replace(decimalSep, ".");
  } else if (hasComma) {
    const commaCount = (body.match(/,/g) ?? []).length;
    if (commaCount > 1) {
      // Mehrere Kommata => Tausendergruppierung (US ohne Dezimalstellen).
      normalized = body.split(",").join("");
    } else {
      // Einzelnes Komma => im de-DE-Kontext das Dezimalzeichen ("12,50" -> 12.5).
      normalized = body.replace(",", ".");
    }
  } else if (hasDot) {
    const dotCount = (body.match(/\./g) ?? []).length;
    if (dotCount > 1) {
      // Mehrere Punkte => Tausenderpunkte.
      normalized = body.split(".").join("");
    } else {
      const [intPart, fracPart = ""] = body.split(".");
      const intDigits = intPart.replace(/^0+/, "");
      if (fracPart.length === 3 && intPart !== "0" && intDigits.length >= 1) {
        // "1.234" -> Tausenderpunkt -> 1234. Fuehrende 0 ("0.500") bleibt Dezimal.
        normalized = intPart + fracPart;
      } else {
        // "12.50", "1.2345", "1234." => Dezimalpunkt.
        normalized = fracPart.length > 0 ? `${intPart}.${fracPart}` : intPart;
      }
    }
  } else {
    normalized = body;
  }

  const value = Number.parseFloat(normalized);
  if (!Number.isFinite(value)) return null;
  return negative ? -value : value;
}

/**
 * Extrahiert den plausibelsten Betrag aus einer einzelnen Zeile.
 * Standardmaessig wird das letzte Zahl-Token verwendet (Belege fuehren den
 * Betrag i.d.R. rechts/am Zeilenende).
 */
export function parseAmountFromLine(
  line: string | null | undefined,
  options: { prefer?: "last" | "max" } = {},
): number | null {
  if (!line) return null;
  const prefer = options.prefer ?? "last";
  const matches = line.match(NUMBER_TOKEN);
  if (!matches) return null;

  const values = matches
    .map((token) => parseAmountValue(token))
    .filter((value): value is number => value !== null);

  if (values.length === 0) return null;
  if (prefer === "max") return Math.max(...values);
  return values[values.length - 1];
}

type KeywordRule = {
  keywords: string[];
  priority: number;
};

// Reihenfolge = Prioritaet fuer den finalen Gesamtbetrag (hoeher = "endgueltiger").
const GROSS_RULES: KeywordRule[] = [
  { keywords: ["zu zahlen", "zahlbetrag", "zu zahlender betrag", "amount due", "grand total", "total due"], priority: 5 },
  { keywords: ["gesamtbetrag", "gesamtsumme", "rechnungsbetrag", "endbetrag", "gesamt brutto", "summe brutto"], priority: 4 },
  { keywords: ["bruttobetrag", "brutto"], priority: 3 },
  { keywords: ["gesamt", "summe", "total"], priority: 2 },
];

const SUBTOTAL_KEYWORDS = ["zwischensumme", "zwischen summe", "subtotal", "sub total", "warenwert", "nettowarenwert"];
const NET_KEYWORDS = ["nettobetrag", "netto betrag", "summe netto", "netto", "net amount", "net"];
const TAX_KEYWORDS = ["mehrwertsteuer", "umsatzsteuer", "mwst", "mwst.", "ust", "ust.", "vat", "steuer", "tax"];

function normalizeLine(line: string): string {
  return line.toLowerCase().replace(/\s+/g, " ").trim();
}

function containsKeyword(haystack: string, keywords: string[]): boolean {
  return keywords.some((kw) => haystack.includes(kw));
}

/**
 * Extrahiert gross/net/tax aus OCR-Rohtext mit Prioritaet auf den Gesamtbetrag.
 * Zwischensummen werden erkannt und niemals als Gesamtbetrag zurueckgegeben.
 */
export function extractAmounts(rawText: string | null | undefined): ExtractedAmounts {
  const result: ExtractedAmounts = {
    grossAmount: null,
    netAmount: null,
    taxAmount: null,
    subtotalAmount: null,
  };
  if (!rawText) return result;

  const lines = rawText.split(/\r?\n/);

  let grossValue: number | null = null;
  let grossPriority = -1;
  let grossIndex = -1;

  let netValue: number | null = null;
  let netIndex = -1;

  let taxValue: number | null = null;
  let taxIndex = -1;

  let subtotalValue: number | null = null;
  let subtotalIndex = -1;

  lines.forEach((rawLine, index) => {
    const line = normalizeLine(rawLine);
    if (!line) return;

    const isSubtotal = containsKeyword(line, SUBTOTAL_KEYWORDS);
    const amount = parseAmountFromLine(rawLine);
    if (amount === null) return;

    if (isSubtotal) {
      if (index > subtotalIndex) {
        subtotalValue = amount;
        subtotalIndex = index;
      }
      // Eine Zwischensummenzeile darf nie als Gesamtbetrag zaehlen.
      return;
    }

    // Gesamtbetrag: hoechste passende Prioritaet gewinnt, bei Gleichstand die
    // spaeter im Dokument stehende Zeile (Belege fuehren den Endbetrag unten).
    for (const rule of GROSS_RULES) {
      if (containsKeyword(line, rule.keywords)) {
        if (
          grossValue === null ||
          rule.priority > grossPriority ||
          (rule.priority === grossPriority && index > grossIndex)
        ) {
          grossValue = amount;
          grossPriority = rule.priority;
          grossIndex = index;
        }
        break;
      }
    }

    // Netto
    if (containsKeyword(line, NET_KEYWORDS) && index > netIndex) {
      netValue = amount;
      netIndex = index;
    }

    // Steuer
    if (containsKeyword(line, TAX_KEYWORDS) && index > taxIndex) {
      taxValue = amount;
      taxIndex = index;
    }
  });

  result.grossAmount = grossValue;
  result.netAmount = netValue;
  result.taxAmount = taxValue;
  result.subtotalAmount = subtotalValue;

  return result;
}

const AMOUNT_EPSILON = 0.02;

function approximatelyEqual(a: number, b: number): boolean {
  return Math.abs(a - b) <= AMOUNT_EPSILON;
}

/**
 * Gleicht die von OpenAI strukturierten Betraege konservativ mit dem OCR-Rohtext ab.
 *
 * Korrigiert nur bei klaren Signalen:
 *  - OpenAI-Gesamtbetrag fehlt         -> lokal erkannten Gesamtbetrag uebernehmen.
 *  - OpenAI-Gesamtbetrag == Zwischensumme und ein groesserer echter Gesamtbetrag
 *    existiert im Text -> Gesamtbetrag korrigieren.
 * Ansonsten bleibt der OpenAI-Wert unveraendert (keine Regressionen).
 */
export function reconcileAmounts(
  openai: { grossAmount: number | null; netAmount: number | null; taxAmount: number | null },
  rawText: string | null | undefined,
): AmountReconciliation {
  const corrections: string[] = [];
  const local = extractAmounts(rawText);

  let grossAmount = openai.grossAmount;
  const netAmount = openai.netAmount;
  const taxAmount = openai.taxAmount;

  if (grossAmount === null && local.grossAmount !== null) {
    grossAmount = local.grossAmount;
    corrections.push(`grossAmount aus OCR-Rohtext ergaenzt (${local.grossAmount}).`);
  } else if (
    grossAmount !== null &&
    local.subtotalAmount !== null &&
    approximatelyEqual(grossAmount, local.subtotalAmount) &&
    local.grossAmount !== null &&
    local.grossAmount > local.subtotalAmount + AMOUNT_EPSILON
  ) {
    // OpenAI hat die Zwischensumme als Gesamtbetrag genommen.
    corrections.push(
      `grossAmount von Zwischensumme (${grossAmount}) auf Gesamtbetrag (${local.grossAmount}) korrigiert.`,
    );
    grossAmount = local.grossAmount;
  }

  return { grossAmount, netAmount, taxAmount, corrections };
}
