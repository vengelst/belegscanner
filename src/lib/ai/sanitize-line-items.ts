/**
 * Bereinigt KI-Positionen: Summenzeilen und Beleg-Gesamtbetrag als Positionspreis
 * fuehren sonst zu Text/Preis-Vertauschungen und dazu, dass nach dem Abwaehlen
 * von Positionen der Rechnungsbetrag gleich dem Original bleibt.
 */

export type SanitizableLineItem = {
  description: string;
  quantity: number | null;
  unit: string | null;
  unitPrice: number | null;
  totalPrice: number | null;
  taxHint: string | null;
};

const SUMMARY_DESCRIPTION =
  /^(zwischensumme|zw\.?\s*summe|summe|gesamt(?:betrag)?|total|endbetrag|rechnungsbetrag|zu\s*zahlen|kassenbetrag|netto(?:betrag)?|brutto(?:betrag)?|mwst|ust|steuer|trinkgeld|tip|rundung|wechselgeld|gegeben|bar\s*gegeben|visa|mastercard|ec[\s-]?karte|kartenzahlung)(\b|:|$)/i;

function nearlyEqual(a: number, b: number, tolerance = 0.03): boolean {
  return Math.abs(a - b) <= Math.max(tolerance, Math.abs(b) * 0.005);
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function sanitizeLineItems(
  items: SanitizableLineItem[],
  grossAmount: number | null,
  warnings: string[],
): SanitizableLineItem[] {
  if (!Array.isArray(items) || items.length === 0) return [];

  const withoutSummaries: SanitizableLineItem[] = [];
  for (const item of items) {
    const description = (item.description ?? "").trim();
    if (!description) continue;
    if (SUMMARY_DESCRIPTION.test(description)) {
      warnings.push(`Summen-/Zahlungszeile als Position verworfen: "${description.slice(0, 60)}"`);
      continue;
    }
    withoutSummaries.push({ ...item, description });
  }

  // Menge × Einzelpreis als Korrektur, wenn der Zeilenbetrag klar nicht passt.
  let cleaned = withoutSummaries.map((item) => {
    if (
      item.quantity == null
      || item.unitPrice == null
      || !Number.isFinite(item.quantity)
      || !Number.isFinite(item.unitPrice)
      || item.quantity <= 0
    ) {
      return item;
    }
    const expected = roundMoney(item.quantity * item.unitPrice);
    if (item.totalPrice == null) {
      return { ...item, totalPrice: expected };
    }
    if (!nearlyEqual(item.totalPrice, expected, 0.05)) {
      warnings.push(
        `Positionsbetrag korrigiert (${item.totalPrice.toFixed(2)} → ${expected.toFixed(2)}) fuer "${item.description.slice(0, 48)}".`,
      );
      return { ...item, totalPrice: expected };
    }
    return item;
  });

  const priced = cleaned.filter(
    (item) => item.totalPrice !== null && Number.isFinite(item.totalPrice),
  );

  // Beleg-Gesamtbetrag darf nicht als Positionspreis stehen, wenn es weitere Positionen gibt.
  // (Nach der Mengenkorrektur, damit quantity×unitPrice den Gesamtbetrag nicht wieder einsetzt.)
  if (grossAmount != null && grossAmount > 0 && priced.length >= 2) {
    cleaned = cleaned.map((item) => {
      if (item.totalPrice == null || !nearlyEqual(item.totalPrice, grossAmount)) return item;
      warnings.push(
        `Positionspreis ${item.totalPrice.toFixed(2)} entsprach dem Beleg-Gesamtbetrag und wurde geleert ("${item.description.slice(0, 48)}").`,
      );
      return {
        ...item,
        totalPrice: null,
        unitPrice: item.unitPrice != null && nearlyEqual(item.unitPrice, grossAmount)
          ? null
          : item.unitPrice,
      };
    });
  }

  const sum = cleaned
    .map((item) => item.totalPrice)
    .filter((value): value is number => value !== null && Number.isFinite(value))
    .reduce((acc, value) => acc + value, 0);

  if (
    grossAmount != null
    && grossAmount > 0
    && sum > 0
    && cleaned.length >= 2
    && (sum > grossAmount * 1.35 || sum < grossAmount * 0.45)
  ) {
    warnings.push(
      `Positionssumme (${roundMoney(sum).toFixed(2)}) weicht stark vom Belegbetrag (${grossAmount.toFixed(2)}) ab – bitte Positionen und Preise pruefen.`,
    );
  }

  return cleaned;
}
