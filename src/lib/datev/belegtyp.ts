/**
 * DATEV-Belegtypen.
 *
 * Bei DATEV Upload Mail (Unternehmen online → Belege → Einstellungen → Upload Mail)
 * bestimmt die Empfaenger-Adresse den Belegtyp: pro Belegtyp legt man in DATEV eine
 * eigene Zieladresse an. Eine Mail an die Adresse fuer "Kasse" landet in der Kasse,
 * eine an die Adresse fuer "Rechnungseingang" im Rechnungseingang.
 *
 * Deshalb ist der Belegtyp am Beleg Pflicht und pro Belegtyp braucht das DATEV-Profil
 * eine eigene Upload-Mail-Adresse.
 *
 * Bewusst frei von Prisma-Importen, damit die Datei auch in Client-Komponenten nutzbar ist.
 */

export const DATEV_BELEGTYP_VALUES = [
  "RECHNUNGSEINGANG",
  "RECHNUNGSAUSGANG",
  "KASSE",
  "KREDITKARTENBELEGE",
  "SONSTIGE",
  "REISEKOSTEN",
] as const;

export type DatevBelegtyp = (typeof DATEV_BELEGTYP_VALUES)[number];

/** Anzeigenamen exakt wie im DATEV-Dialog "Belegtyp hinzufuegen". */
export const datevBelegtypLabels: Record<DatevBelegtyp, string> = {
  RECHNUNGSEINGANG: "Rechnungseingang",
  RECHNUNGSAUSGANG: "Rechnungsausgang",
  KASSE: "Kasse",
  KREDITKARTENBELEGE: "Kreditkartenbelege",
  SONSTIGE: "Sonstige",
  REISEKOSTEN: "DATEV Reisekosten-Belege",
};

/** Kurzer Zusatzhinweis fuer die Auswahl im Erfassungsformular. */
export const datevBelegtypHints: Record<DatevBelegtyp, string> = {
  RECHNUNGSEINGANG: "Kreditor / Eingangsbeleg",
  RECHNUNGSAUSGANG: "Debitor / Ausgangsbeleg",
  KASSE: "Barzahlung / Kassenbeleg",
  KREDITKARTENBELEGE: "Kreditkartenzahlung",
  SONSTIGE: "Sonstige Belege",
  REISEKOSTEN: "Reisekosten",
};

export function isDatevBelegtyp(value: unknown): value is DatevBelegtyp {
  return typeof value === "string" && (DATEV_BELEGTYP_VALUES as readonly string[]).includes(value);
}

export function datevBelegtypLabel(value: unknown): string | null {
  return isDatevBelegtyp(value) ? datevBelegtypLabels[value] : null;
}

/**
 * Fachliche Vorbelegung aus Belegrichtung und Kategorie.
 *
 * | Bedingung              | Vorschlag          |
 * |------------------------|--------------------|
 * | partyRole = DEBTOR     | Rechnungsausgang   |
 * | Kategorie ~ /kasse/i   | Kasse              |
 * | Kategorie ~ /kreditkarte/i | Kreditkartenbelege |
 * | Kategorie ~ /reise/i   | Reisekosten        |
 * | sonst                  | Rechnungseingang   |
 */
export function suggestDatevBelegtyp({
  partyRole,
  categoryName,
}: {
  partyRole?: "CREDITOR" | "DEBTOR" | null;
  categoryName?: string | null;
}): DatevBelegtyp {
  if (partyRole === "DEBTOR") return "RECHNUNGSAUSGANG";

  const name = categoryName?.trim() ?? "";
  if (/kasse/i.test(name)) return "KASSE";
  if (/kreditkarte/i.test(name)) return "KREDITKARTENBELEGE";
  if (/reise/i.test(name)) return "REISEKOSTEN";

  return "RECHNUNGSEINGANG";
}

// ============================================================
// Adressauflösung fuer den Versand
// ============================================================

export type DatevBelegtypAddressEntry = {
  belegtyp: DatevBelegtyp;
  datevAddress: string;
};

export type DatevAddressResolution =
  | { ok: true; address: string; source: "belegtyp" | "fallback" }
  | { ok: false; error: string };

/**
 * Ermittelt die DATEV-Upload-Adresse fuer den Belegtyp eines Belegs.
 *
 * 1. Adresse aus den Belegtyp-Adressen des Profils
 * 2. Fallback nur fuer RECHNUNGSEINGANG auf die Standardadresse des Profils
 *    (Kompatibilitaet mit bestehenden Installationen)
 * 3. Sonst Fehler
 */
export function resolveDatevAddress({
  belegtyp,
  addresses,
  fallbackAddress,
}: {
  belegtyp: DatevBelegtyp | null | undefined;
  addresses: DatevBelegtypAddressEntry[];
  fallbackAddress?: string | null;
}): DatevAddressResolution {
  if (!belegtyp) {
    return { ok: false, error: "Kein DATEV-Belegtyp am Beleg gesetzt." };
  }

  const match = addresses.find(
    (entry) => entry.belegtyp === belegtyp && entry.datevAddress.trim() !== "",
  );
  if (match) {
    return { ok: true, address: match.datevAddress.trim(), source: "belegtyp" };
  }

  if (belegtyp === "RECHNUNGSEINGANG" && fallbackAddress?.trim()) {
    return { ok: true, address: fallbackAddress.trim(), source: "fallback" };
  }

  return {
    ok: false,
    error: `Keine DATEV-Upload-Adresse fuer Belegtyp "${datevBelegtypLabels[belegtyp]}" konfiguriert.`,
  };
}
