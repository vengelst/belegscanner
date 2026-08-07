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

/**
 * Belegtyp fuer neue Belege, solange in den Einstellungen nichts anderes
 * hinterlegt ist. Der Regelfall ist der Eingangsbeleg (Kreditor); alle anderen
 * Typen waehlt der Nutzer bewusst.
 */
export const DEFAULT_DATEV_BELEGTYP: DatevBelegtyp = "RECHNUNGSEINGANG";

/**
 * Beschriftung des Belegtyp-Feldes in Erfassung, Bearbeitung, Filter und Liste.
 * "Kategorie" steht nur zur Orientierung in Klammern - fachlich fuehrend ist
 * der DATEV-Belegtyp.
 */
export const DATEV_BELEGTYP_FIELD_LABEL = "DATEV-Belegtyp (Kategorie)";

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

/**
 * Eigene Bezeichnungen je Belegtyp aus den Organisationseinstellungen.
 * Nur abweichende Namen werden gespeichert - fehlt ein Eintrag, gilt der
 * DATEV-Standardname.
 */
export type DatevBelegtypLabelOverrides = Partial<Record<DatevBelegtyp, string>>;

/**
 * Bringt beliebige Eingaben (JSON aus der Datenbank, Request-Body) auf die
 * gespeicherte Form: nur bekannte Belegtypen, getrimmt, leere Werte verworfen.
 */
export function normalizeDatevBelegtypLabelOverrides(value: unknown): DatevBelegtypLabelOverrides {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  const overrides: DatevBelegtypLabelOverrides = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (!isDatevBelegtyp(key) || typeof raw !== "string") continue;
    const label = raw.trim();
    if (label) overrides[key] = label;
  }
  return overrides;
}

/** Anzeigename eines Belegtyps - eigene Bezeichnung vor DATEV-Standardname. */
export function resolveDatevBelegtypLabel(
  belegtyp: DatevBelegtyp,
  overrides?: DatevBelegtypLabelOverrides | null,
): string {
  return overrides?.[belegtyp]?.trim() || datevBelegtypLabels[belegtyp];
}

/** Alle Anzeigenamen auf einmal, z. B. fuer Auswahlfelder und Listenspalten. */
export function resolveDatevBelegtypLabels(
  overrides?: DatevBelegtypLabelOverrides | null,
): Record<DatevBelegtyp, string> {
  return Object.fromEntries(
    DATEV_BELEGTYP_VALUES.map((belegtyp) => [belegtyp, resolveDatevBelegtypLabel(belegtyp, overrides)]),
  ) as Record<DatevBelegtyp, string>;
}

export function datevBelegtypLabel(
  value: unknown,
  overrides?: DatevBelegtypLabelOverrides | null,
): string | null {
  return isDatevBelegtyp(value) ? resolveDatevBelegtypLabel(value, overrides) : null;
}

// ============================================================
// Firmenkarten
// ============================================================

/** Endziffern der Firmenkarten fuer eine frische Installation. */
export const DEFAULT_COMPANY_CARD_LAST_DIGITS = ["2454", "2350"];

/** Reduziert eine Kartenangabe auf reine Ziffern ("**** 2454" -> "2454"). */
export function normalizeCardLastDigits(value: string | null | undefined): string {
  return (value ?? "").replace(/\D/g, "");
}

/**
 * Prueft, ob eine per OCR erkannte Kartenendung zu einer hinterlegten
 * Firmenkarte gehoert.
 *
 * Bevorzugt wird der exakte Vergleich (4 gegen 4). Ein Suffix-Vergleich greift
 * nur, wenn beide Seiten mindestens 4 Ziffern haben - sonst waere z. B. "54"
 * gegen "2454" ein Zufallstreffer.
 */
export function matchesCompanyCard(
  cardLastDigits: string | null | undefined,
  companyCardLastDigits: readonly string[] | null | undefined,
): boolean {
  const detected = normalizeCardLastDigits(cardLastDigits);
  if (!detected) return false;

  return (companyCardLastDigits ?? []).some((entry) => {
    const known = normalizeCardLastDigits(entry);
    if (!known) return false;
    if (known === detected) return true;
    if (known.length < 4 || detected.length < 4) return false;
    return detected.endsWith(known) || known.endsWith(detected);
  });
}

/** Zahlungsarten, die auf eine Kartenzahlung hindeuten. */
const CARD_PAYMENT_METHODS = new Set(["credit_card", "debit_card", "visa", "mastercard"]);

// ============================================================
// Vorbelegung aus der Belegerkennung
// ============================================================

export type SuggestDatevBelegtypInput = {
  partyRole?: "CREDITOR" | "DEBTOR" | null;
  paymentMethod?: string | null;
  cardLastDigits?: string | null;
  documentType?: string | null;
  /** Endziffern der Firmenkarten aus den Organisationseinstellungen. */
  companyCardLastDigits?: readonly string[] | null;
};

/**
 * Fachliche Vorbelegung des Belegtyps aus den Erkennungsdaten. Die Kategorie
 * spielt keine Rolle mehr - der Nutzer pflegt nur noch den Belegtyp.
 *
 * Reihenfolge der Regeln:
 *
 * | Bedingung                                   | Vorschlag          |
 * |---------------------------------------------|--------------------|
 * | partyRole = DEBTOR (Ausgangsrechnung)       | Rechnungsausgang   |
 * | Kartenzahlung mit Firmenkarten-Endziffern   | Kreditkartenbelege |
 * | Kartenzahlung mit fremder/unbekannter Karte | Kasse              |
 * | Barzahlung                                  | Kasse              |
 * | Bewirtung                                   | Rechnungseingang   |
 * | sonst (Eingangsbeleg)                       | Rechnungseingang   |
 * | keinerlei belastbare Angaben                | Standard-Belegtyp  |
 *
 * Fremde Karten landen bewusst in der Kasse: privat bezahlte Belege werden
 * ueber die Barkasse erstattet.
 *
 * Ohne belastbare Erkennung wird nicht geraten, sondern der in den
 * Einstellungen gepflegte Standard-Belegtyp gesetzt (i. d. R. Rechnungseingang).
 */
export function suggestDatevBelegtyp(
  {
    partyRole,
    paymentMethod,
    cardLastDigits,
    documentType,
    companyCardLastDigits,
  }: SuggestDatevBelegtypInput,
  { defaultBelegtyp = DEFAULT_DATEV_BELEGTYP }: { defaultBelegtyp?: DatevBelegtyp } = {},
): DatevBelegtyp {
  if (partyRole === "DEBTOR") return "RECHNUNGSAUSGANG";

  const method = paymentMethod?.trim().toLowerCase() ?? "";
  const digits = normalizeCardLastDigits(cardLastDigits);
  const type = documentType?.trim().toLowerCase() ?? "";

  if (CARD_PAYMENT_METHODS.has(method) || digits) {
    return matchesCompanyCard(digits, companyCardLastDigits) ? "KREDITKARTENBELEGE" : "KASSE";
  }

  if (method === "cash") return "KASSE";

  if (type === "hospitality" || type === "bewirtung") return "RECHNUNGSEINGANG";

  const hasSignal = Boolean(
    partyRole
    || (method && method !== "unknown")
    || (type && type !== "general"),
  );
  if (!hasSignal) return defaultBelegtyp;

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
