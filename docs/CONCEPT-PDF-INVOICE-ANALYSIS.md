# Ausbaukonzept: PDF-Rechnungsanalyse

## Gesamtziel

Die bestehende BelegBox-App wird um eine gezielte PDF-Rechnungsanalyse erweitert. Wenn ein PDF hochgeladen wird, soll die App:

- erkennen, ob das PDF textbasiert oder gescannt ist (existiert bereits in `src/lib/ocr.ts`)
- den Text auslesen (existiert bereits: `pdf-parse` + Tesseract.js-Fallback)
- **NEU:** strukturierte Rechnungsdaten ableiten (Netto/MwSt/Brutto, Positionen, Leistungsdatum etc.)
- **NEU:** die relevanten Felder in der App vorbelegen und als Vorschlaege darstellen
- **NEU:** unsichere Werte markieren und manuelle Korrekturen zulassen
- Original-PDF unverändert speichern (existiert bereits via `ReceiptFile`)

### Was schon da ist und weiterverwendet wird

| Bereich | Status | Dateien |
|---------|--------|---------|
| PDF-Typ-Erkennung (text/scan/empty) | Existiert | `src/lib/ocr.ts:248-347` |
| Text-Extraktion (pdf-parse) | Existiert | `src/lib/ocr.ts:281-291` |
| OCR-Fallback (Tesseract.js, 3 Seiten) | Existiert | `src/lib/ocr.ts:294-326` |
| Basisfeld-Extraktion (Datum, Betrag, Waehrung, Lieferant, Rechnungsnr.) | Existiert | `src/lib/ocr.ts:502-541` |
| Confidence-Modell pro Feld | Existiert | `OcrResult.fieldConfidence` |
| Smart-Capture-Suggestions UI | Existiert | `src/components/receipts/smart-capture-suggestions.tsx` |
| ocrStructuredData JSON-Feld | Existiert | `Receipt.ocrStructuredData` in Prisma |
| Dokumenttyp-Erkennung | Existiert | `DocumentType` Enum (6 Typen) |
| Datei-Upload + Speicherung | Existiert | `ReceiptFile` + `/api/files/upload` |

### Was fehlt und gebaut werden muss

| Bereich | Status |
|---------|--------|
| Steuerzerlegung (Netto/MwSt/Brutto) | Fehlt komplett |
| Mehrere MwSt-Saetze | Fehlt komplett |
| Rechnungspositionen/Positionszeilen | Nur rudimentaer fuer Hospitality/Lodging |
| Leistungsdatum | Fehlt |
| Kundennummer/Referenz | Fehlt |
| Adresse/Empfaenger | Fehlt |
| `invoiceNumber` als DB-Feld auf Receipt | Fehlt (nur in ocrStructuredData) |
| Plausibilitaetspruefung Betraege | Fehlt |
| Erweitertes Review-UI fuer Rechnungsfelder | Fehlt |
| Mehrseitige PDF-Verarbeitung (>3 Seiten) | Fehlt |
| Gemischte PDFs (Text+Scan) | Fehlt |

---

## 1. PDF-Typ-Erkennung

### Ist-Zustand

Die Funktion `analyzePdf()` in `src/lib/ocr.ts:268-347` macht bereits:

1. Text-Extraktion via `pdf-parse` → prueft mit `hasMeaningfulText()` ob genuegend Text vorhanden
2. Falls ja → `sourceType: "pdf-text"`, Confidence 0.92
3. Falls nein → Seiten rendern, Tesseract.js OCR → `sourceType: "pdf-scan"`
4. Falls auch OCR leer → `sourceType: "pdf-empty"`

### Erweiterung

**Gemischte PDFs erkennen:**

Manche PDFs haben textbasierte Seiten (z.B. Seite 1 mit Kopfdaten) und gescannte Seiten (z.B. Seite 2 mit handschriftlichen Notizen). Das betrifft in der Praxis ca. 5-10% der Rechnungs-PDFs.

Vorschlag:
- Nach der Text-Extraktion pruefen, ob der extrahierte Text **pro Seite** ausreichend ist
- Wenn einzelne Seiten weniger als 12 Zeichen haben, diese Seiten zusaetzlich per OCR verarbeiten
- Neuer `sourceType: "pdf-mixed"` fuer diese Faelle
- Text aus beiden Quellen zusammenfuehren, mit Seitenbezug

**Defekte PDFs:**

- Wenn `pdf-parse` eine Exception wirft → `sourceType: "pdf-error"`
- Wenn PDF passwortgeschuetzt → eigene Fehlermeldung
- Beides bereits teilweise abgefangen im `catch`-Block, aber ohne differenzierte Fehlermeldung

### Konkrete Aenderungen

```
Datei: src/lib/ocr.ts

1. OcrSourceType erweitern:
   "image" | "pdf-text" | "pdf-scan" | "pdf-mixed" | "pdf-empty" | "pdf-error"

2. analyzePdf() erweitern:
   - Nach getText(): Text pro Seite auswerten (Seitentrennzeichen nutzen)
   - Seiten ohne Text identifizieren und separat per OCR verarbeiten
   - Ergebnisse zusammenfuehren

3. Fehlerbehandlung differenzieren:
   - Passwort-geschuetztes PDF → eigene Meldung
   - Korruptes PDF → eigene Meldung
```

### Bewertung

- **Aufwand:** Gering. Erweiterung der bestehenden `analyzePdf()`-Funktion
- **Risiko:** Niedrig. Aenderung ist abwaertskompatibel
- **Prioritaet:** Phase A - Grundlage fuer alles Weitere

---

## 2. Text-Extraktion vs. OCR

### Ist-Zustand

Beide Pfade existieren bereits und muenden in dieselbe `buildResult()` → `parseReceiptText()` Pipeline. Das ist das richtige Design und bleibt bestehen.

### Erweiterung

**Fuer textbasierte PDFs (Hauptfall bei Rechnungen):**

Die meisten Lieferantenrechnungen sind digital erzeugte PDFs mit eingebettetem Text. Hier ist die Text-Extraktion via `pdf-parse` die primaere Quelle. Aenderungen:

- **Seitenbezug beibehalten**: Text pro Seite getrennt extrahieren und den Seitenbezug im Parsing mitfuehren. Das ist wichtig fuer mehrseitige Rechnungen, wo Kopfdaten auf Seite 1 und Positionszeilen auf Seiten 2-n stehen.
- **Zeilenstruktur bewahren**: pdf-parse liefert mit `lineEnforce: true` bereits zeilenweisen Text. Diese Zeilenstruktur ist die Grundlage fuer Positionsextraktion.

**Fuer gescannte PDFs:**

- Seiten-Limit von 3 auf 5 erhoehen (Rechnungen sind oft 2-4 Seiten lang)
- OCR-Sprache konfigurierbar lassen (bereits via `OCR_LANGUAGE` env var)
- Ggf. Bild-Vorverarbeitung (Kontrast/Schaerfe) vor OCR - hier existiert bereits `receipt-image-processing.ts` fuer Kamera-Bilder, kann fuer PDF-Seitenbilder wiederverwendet werden

**Gemeinsame Pipeline:**

```
PDF Upload
    │
    ├─ Text-Extraktion (pdf-parse)
    │   └─ hasMeaningfulText() pro Seite?
    │       ├─ Ja → Text verwenden
    │       └─ Nein → OCR fuer diese Seite
    │
    └─ Zusammengefuehrter Text (mit Seitenbezug)
        │
        └─ parseReceiptText()  ← BESTEHEND, wird erweitert
            ├─ Basisfelder (existiert)
            ├─ NEU: Steuerzerlegung
            ├─ NEU: Positionszeilen
            └─ NEU: Erweiterte Rechnungsfelder
```

### Konkrete Aenderungen

```
Datei: src/lib/ocr.ts

1. MAX_PDF_SCAN_PAGES: 3 → 5

2. analyzePdf(): Text mit Seitentrenner ("\n---PAGE---\n") zusammenfuehren

3. Neuer interner Typ:
   type PageText = { page: number; text: string; source: "text" | "ocr" }

4. parseReceiptText() erhaelt optional PageText[] statt nur string
   (abwaertskompatibel: string wird als einzelne Seite behandelt)
```

### Fallback-Logik

1. Text-Extraktion erfolgreich → verwenden
2. Text-Extraktion unzureichend → OCR
3. OCR unzureichend → Meldung "Bitte manuell erfassen"
4. PDF defekt → Meldung "PDF konnte nicht gelesen werden"

Kein Risiko von Dopplungen: Text-Extraktion und OCR laufen nie fuer dieselbe Seite parallel.

---

## 3. Strukturierte Rechnungsfelder

### Feld-Analyse nach Zuverlaessigkeit

#### Robust erkennbar (>80% Trefferquote bei textbasierten PDFs)

| Feld | Erkennungsmethode | Schon vorhanden? |
|------|-------------------|------------------|
| **Rechnungsdatum** | Keywords + Datumsformat | Ja, `extractDate()` |
| **Gesamtbetrag** | Keywords "Gesamt/Total/Brutto" + groesster Betrag | Ja, `extractAmount()` |
| **Waehrung** | Waehrungssymbole/-codes | Ja, `extractCurrency()` |
| **Rechnungsnummer** | Keywords "Rechnungsnr/Invoice No" + alphanumerisches Muster | Ja, `extractInvoiceNumber()` |

#### Begrenzt zuverlaessig erkennbar (50-80%)

| Feld | Erkennungsmethode | Schon vorhanden? |
|------|-------------------|------------------|
| **Lieferant** | Erste nicht-triviale Zeilen im Kopfbereich | Ja, `extractSupplier()` - aber einfach |
| **Nettobetrag** | Keyword "Netto" + Betrag | Nein |
| **MwSt-Betrag** | Keywords "MwSt/USt/VAT" + Betrag | Nein |
| **MwSt-Satz** | Prozentwert neben MwSt-Keyword | Nein |
| **Zahlungsart** | Keywords Karte/Bar/Ueberweisung | Ja, `extractPaymentMethod()` |

#### Nur als Vorschlag behandeln (<50%)

| Feld | Erkennungsmethode | Schon vorhanden? |
|------|-------------------|------------------|
| **Leistungsdatum** | Keywords "Leistungsdatum/Leistungszeitraum" | Nein |
| **Kundennummer** | Keywords "Kundennr/Customer No" | Nein |
| **Adresse/Ort** | Postleitzahl + Ortsname | Teilweise, `extractLocation()` |
| **Land** | USt-ID/Telefon/PLZ-Muster | Ja, `extractCountry()` |
| **Kartenendziffern** | Muster nach Kartenbezeichnung | Ja, `extractCardLastDigits()` |

### Neue Extraktionsfunktionen

```
Datei: src/lib/ocr.ts (Erweiterung von parseReceiptText)

Neue Funktionen:
- extractServiceDate(text): Leistungsdatum/-zeitraum
- extractNetAmount(text, lines): Nettobetrag
- extractTaxBreakdown(text, lines): MwSt-Zeilen mit Satz/Betrag
- extractGrossAmount(text, lines): Bruttobetrag (Kreuzpruefung mit amount)
- extractCustomerNumber(lines): Kundennummer
- extractInvoiceAddress(lines): Rechnungsadresse (nur als Vorschlag)
```

### Erweiterung OcrResult

```typescript
// Neuer Block in OcrResult.extracted:
invoice: {
  serviceDate: string | null;         // Leistungsdatum
  servicePeriod: string | null;       // Leistungszeitraum ("01.03.-31.03.2026")
  customerNumber: string | null;      // Kundennummer
  netAmount: number | null;           // Nettobetrag
  taxLines: Array<{
    rate: number;                     // z.B. 19 oder 7
    netAmount: number | null;         // Netto fuer diesen Satz
    taxAmount: number;                // Steuerbetrag
  }>;
  grossAmount: number | null;         // Bruttobetrag
  invoiceAddress: string | null;      // Rechnungsadresse (mehrzeilig)
} | null;

// Dazu passend in fieldConfidence:
invoiceConfidence: {
  serviceDate: OcrConfidenceLevel;
  servicePeriod: OcrConfidenceLevel;
  customerNumber: OcrConfidenceLevel;
  netAmount: OcrConfidenceLevel;
  taxBreakdown: OcrConfidenceLevel;
  grossAmount: OcrConfidenceLevel;
  invoiceAddress: OcrConfidenceLevel;
} | null;
```

---

## 4. Positionszeilen / Rechnungspositionen

### Ist-Zustand

Es gibt bereits `extractLineItems()` und `extractTypedLineItems()` in `src/lib/ocr.ts:869-892`. Diese extrahieren einfache `{ label, amount }` Paare. Das funktioniert fuer Kassenbons, ist aber zu simpel fuer Rechnungspositionen.

### Fachliche Bewertung

**Realistische Erwartung fuer Phase 1:**

Positionsextraktion aus PDFs ist eines der schwierigsten Parsing-Probleme, weil:
- Tabellenstrukturen ohne echte Tabellenlinien
- Unterschiedliche Spaltenreihenfolgen
- Mehrzeilige Artikelbezeichnungen
- Seiteumbrueche in Tabellen
- OCR-Fehler in Zahlen

**Empfehlung:**

Positionszeilen in Phase 1 als **Vorschlagsdaten** behandeln, nicht als harte strukturierte Kerndaten. Sie werden:
- im ocrStructuredData-JSON gespeichert
- in der UI angezeigt
- NICHT in einer eigenen DB-Tabelle gespeichert (erst in Phase 2, wenn Qualitaet ausreichend)

### Datenmodell fuer Positionen

```typescript
// Im OcrResult (Vorschlagsdaten):
type OcrInvoiceLineItem = {
  position: number;                // Positionsnummer (1, 2, 3...)
  description: string;             // Artikelbezeichnung
  quantity: number | null;         // Menge
  unit: string | null;             // Einheit (Stk, kg, h, ...)
  unitPrice: number | null;        // Einzelpreis
  totalPrice: number | null;       // Gesamtpreis der Position
  taxRate: number | null;          // MwSt-Satz (19, 7, ...)
  confidence: OcrConfidenceLevel;  // Confidence fuer die gesamte Zeile
};
```

### Extraktionslogik

**Fuer textbasierte PDFs:**

1. Tabellenheader erkennen: Suche nach Zeilen mit Keywords wie "Pos", "Bezeichnung", "Menge", "Einzelpreis", "Gesamtpreis", "Betrag", "Netto"
2. Spaltenstruktur ableiten: Aus dem Header die ungefaehren Spaltenpositionen bestimmen (bei festbreitigen Texten) oder Trennmuster erkennen (bei Tab-/Leerzeichen-getrennten Texten)
3. Folgezeilen als Positionen parsen, bis ein Summenbereich erkannt wird
4. Mehrzeilige Bezeichnungen: Wenn eine Zeile keinen Betrag enthaelt, zum vorherigen Item anhaengen

**Fuer gescannte PDFs:**

- Gleiche Logik auf OCR-Text anwenden
- Niedrigere Confidence automatisch
- Plausibilitaetspruefung: Summe der Positionsbetraege ≈ Netto/Brutto

### Typische Probleme und Umgang

| Problem | Umgang |
|---------|--------|
| Kein Tabellenheader erkannt | Keine Positionen extrahieren, nur Gesamtbetrag |
| Spalten nicht zuordenbar | Nur Beschreibung + letzter Betrag pro Zeile |
| Mehrseitige Tabelle | Seitenumbruch erkennen (wiederholter Header), fortsetzen |
| OCR-Fehler in Zahlen | Positionssumme vs. Gesamtbetrag pruefen |
| Unterschiedliche Layouts | Mehrere Heuristiken nacheinander, beste nehmen |

### Was sofort, was spaeter

| Zeitpunkt | Umfang |
|-----------|--------|
| Phase 1 | Einfache Positionsextraktion: Beschreibung + Betrag. Keine Mengen/Einheiten. Vorschlagsdaten in ocrStructuredData. |
| Phase 2 | Menge, Einheit, Einzelpreis. Eigene DB-Tabelle `InvoiceLineItem`. Summen-Plausibilitaet. |
| Spaeter/Optional | Mehrseitige Tabellen, Layout-Analyse, Spaltentyp-Erkennung |

---

## 5. Netto / MwSt / Brutto

### Extraktionslogik

**Primaerer Ansatz: Keyword-basiert**

```
Suchbegriffe fuer Netto:    "Netto", "netto", "Zwischensumme", "subtotal", "net"
Suchbegriffe fuer MwSt:     "MwSt", "USt", "Umsatzsteuer", "VAT", "Mehrwertsteuer"
Suchbegriffe fuer Brutto:   "Brutto", "Gesamt", "Total", "Endbetrag", "Rechnungsbetrag", "zu zahlen"
Suchbegriffe fuer MwSt-Satz: Prozentwerte neben MwSt-Keywords (7%, 19%, 20%, 25%)
```

**Steuerzerlegung extrahieren:**

```typescript
function extractTaxBreakdown(text: string, lines: string[]): TaxBreakdownResult {
  // 1. Suche nach MwSt-Zeilen mit Satz + Betrag
  //    Muster: "MwSt 19%   45,22 EUR" oder "19% USt   45,22"
  //
  // 2. Suche nach Netto-Zeilen
  //    Muster: "Netto   238,00" oder "Zwischensumme   238,00"
  //
  // 3. Suche nach Brutto-Zeile
  //    Muster: "Brutto   283,22" oder "Gesamtbetrag   283,22"
  //
  // 4. Plausibilitaetspruefung:
  //    - Netto + Summe(MwSt) ≈ Brutto (±0.02 Toleranz fuer Rundung)
  //    - Brutto ≈ bestehender extractAmount()-Wert
}
```

### Mehrere MwSt-Saetze

Viele Rechnungen haben gemischte Saetze (z.B. 19% + 7% bei Hotelrechnungen mit Fruehstueck). Datenmodell:

```typescript
type TaxLine = {
  rate: number;           // z.B. 19
  netAmount: number | null;
  taxAmount: number;
};

type TaxBreakdown = {
  netTotal: number | null;
  taxLines: TaxLine[];
  grossTotal: number | null;
};
```

### Faelle und Behandlung

| Fall | Behandlung |
|------|------------|
| Netto + MwSt + Brutto alle erkannt | Plausibilitaet pruefen, high confidence |
| Nur Brutto erkannt | Als `amount` verwenden, Steuer nicht aufteilen, medium confidence |
| Mehrere Brutto-Betraege | Groessten nehmen oder den mit "Gesamt"-Keyword, low confidence |
| Widerspruch Netto+MwSt ≠ Brutto | Beide Werte anzeigen, Nutzer muss entscheiden |
| Fremdwaehrung | Betraege in Originalwaehrung, Umrechnung separat (existiert bereits) |
| Nur Gesamtbetrag (Kassenbon) | Kein Steuer-Aufschlueselung, nur amount |

### Plausibilitaetspruefung

```
1. Netto + Summe(MwSt-Betraege) = Brutto?  (±0.02 EUR Toleranz)
2. Brutto = amount aus extractAmount()?
3. MwSt-Satz plausibel? (Bekannte Saetze: 0%, 5%, 7%, 10%, 13%, 19%, 20%, 25%)
4. Netto < Brutto?
```

Wenn Plausibilitaet fehlschlaegt → Confidence auf "low" setzen und Review-Hinweis anzeigen.

### Confidence-Zuordnung

- Alle drei Werte gefunden + Plausibilitaet OK → `high`
- Zwei von drei gefunden oder Plausibilitaet marginal → `medium`
- Nur ein Wert oder Widerspruch → `low`
- Nichts gefunden → `none`

---

## 6. Lieferant / Rechnungsnummer / Datum

### Ist-Zustand und Schwaechen

**`extractSupplier()` (Zeile 644-657):**
Nimmt die erste nicht-triviale Zeile mit Alpha-Ratio > 0.3 aus den ersten 8 Zeilen. Das funktioniert bei Kassenbons (Logo/Name oben), aber nicht bei formellen Rechnungen, wo der Absender oft in einem Briefkopf steht und die ersten Zeilen Adressen sein koennen.

**`extractInvoiceNumber()` (Zeile 659-683):**
Sucht in den ersten 25 Zeilen nach Keywords + alphanumerischem Muster. Funktioniert gut bei deutschen Rechnungen mit "Rechnungsnr." im Text.

**`extractDate()` (Zeile 550-570):**
Sucht nach Keywords wie "Datum" + Datumsformat. Funktioniert, aber erkennt nicht zwischen Rechnungsdatum und Leistungsdatum.

### Erweiterungen

**Lieferant - verbesserte Erkennung:**

```
1. USt-ID-Heuristik: Wenn eine USt-ID (z.B. DE123456789) im Kopfbereich steht,
   sind die 1-3 Zeilen darueber wahrscheinlich der Lieferantenname.

2. Briefkopf-Heuristik: In formellen Rechnungen steht der Lieferant oft
   in den ersten 5-7 Zeilen (Firmenname, Strasse, PLZ Ort).
   Der Empfaenger steht im Adressfenster (Zeilen 8-15).
   Unterscheidung: Der Block VOR "An" / "Herrn" / "Firma" / "z.Hd." ist der Lieferant.

3. Fettdruck / Grossschreibung: Zeilen in Grossbuchstaben im Kopfbereich
   haben hoehere Lieferanten-Wahrscheinlichkeit (schon teilweise drin: hasUpper check).
```

**Rechnungsnummer - erweitertes Pattern:**

```
Zusaetzliche Keywords:
- "Re.Nr.", "Re-Nr.", "Rechnung Nr.", "Faktura", "Belegnr."
- Englisch: "Inv.", "Invoice #", "Document No."
- Muster: Auch Rechnungsnummern mit Schraegstrichen (2026/0042)
  und Bindestrichen (RE-2026-0042) zuverlaessig matchen
```

**Datum-Erweiterung:**

```
1. Rechnungsdatum: Keywords "Rechnungsdatum", "Datum", "Date", "Invoice Date"
   → mapped auf Receipt.date (existiert)

2. Leistungsdatum: Keywords "Leistungsdatum", "Leistungszeitraum",
   "Lieferdatum", "Service Date", "Performance Period"
   → neues Feld, in ocrStructuredData.invoice.serviceDate

3. Faelligkeitsdatum: Keywords "Faellig", "Zahlbar bis", "Due Date"
   → optional, nur als Vorschlag
```

### Heuristik-Grenzen

| Heuristik | Funktioniert bei | Grenze |
|-----------|-----------------|--------|
| Lieferant aus Kopfbereich | 70-80% der Rechnungen | Scheitert bei unueblichen Layouts |
| USt-ID-basiert | Deutsche/EU-Rechnungen | Nicht vorhanden bei Kleinunternehmern |
| Rechnungsnr. per Keyword | 80-90% | Scheitert bei ungewoehnlichen Labels |
| Datum per Keyword | 85-90% | Verwechslung Rechnungs-/Leistungsdatum |

### Vermeidung von Fehlzuordnungen

- **Rechnungsnummer vs. Kundennummer:** Separate Keyword-Listen, Rechnungsnr. hat Vorrang
- **Rechnungsdatum vs. Leistungsdatum:** Wenn nur ein Datum erkannt → als Rechnungsdatum, mit "medium" confidence
- **Lieferant vs. Empfaenger:** Absender kommt VOR dem Adressfenster, Empfaenger NACH "An/Firma/z.Hd."

---

## 7. Land / Waehrung

### Ist-Zustand

`extractCountry()` in Zeile 894-918 nutzt bereits ein Scoring-System mit Keywords, USt-ID, Telefon, PLZ, Waehrung. Unterstuetzte Laender: DE, AT, HR, RS, MK.

`extractCurrency()` in Zeile 631-642 erkennt 15 Waehrungen.

### Erweiterung

**Zusaetzliche Laender-Regeln:**

```
Neue COUNTRY_RULES fuer:
- CH (Schweiz): Keywords, CHE-USt-ID, +41, PLZ 4-stellig
- IT (Italien): Keywords, IT+11 Ziffern, +39
- FR (Frankreich): Keywords, FR+2Buchst+9Ziffern, +33
- CZ (Tschechien): Keywords, CZ+8-10Ziffern, +420
- PL (Polen): Keywords, PL+10Ziffern, +48
- HU (Ungarn): Keywords, HU+8Ziffern, +36
- SI (Slowenien): Keywords, SI+8Ziffern, +386
- BA (Bosnien): Keywords, +387
```

Diese Laender decken die haeufigsten Geschaeftsreise-Ziele ab.

**Land-Waehrung-Zusammenfuehrung:**

Logik (bereits teilweise in smart-capture-suggestions.tsx):

```
1. Waehrung aus PDF erkannt → hoechste Prioritaet
2. Land aus PDF erkannt → Waehrung aus Country.currencyCode ableiten
3. Widerspruch (z.B. CHF auf deutschem Beleg) → Nutzer fragen
4. Nichts erkannt → User-Default verwenden
```

**Wechselkurs-Logik:**

Existiert bereits vollstaendig:
- `Receipt.exchangeRate`, `exchangeRateDate`, `amountEur`
- `currencyRefinement` in validation.ts
- UI fuer Waehrungsumrechnung in receipt-form.tsx

Keine Aenderung noetig. Die PDF-Analyse muss nur die Werte korrekt vorbefuellen.

### Wann Land aktiv abgefragt werden sollte

- Wenn `country` Confidence = "none" → Land-Feld leer lassen, kein Vorschlag
- Wenn `country` Confidence = "low" → Vorschlag anzeigen, NICHT automatisch uebernehmen
- Wenn `country` Confidence = "medium"/"high" → Vorschlag anzeigen und auto-apply (existiert bereits)

---

## 8. Confidence- / Review-Logik

### Ist-Zustand

Das Confidence-Modell existiert bereits mit 4 Stufen: `"high" | "medium" | "low" | "none"`.
In `ocrStructuredData.fieldReviewStates` koennen Zustaende pro Feld gespeichert werden:
`"detected_confident" | "detected_uncertain" | "not_detected" | "user_confirmed" | "user_overridden"`

Die Smart-Capture-Suggestions UI zeigt diese bereits farbcodiert an.

### Erweiterung

**Erweitertes Statusmodell fuer Rechnungsfelder:**

Das bestehende Modell wird beibehalten und konsistent auf die neuen Felder angewendet:

```
detected_confident   → OCR-Ergebnis mit high confidence
detected_uncertain   → OCR-Ergebnis mit medium/low confidence
not_detected         → Feld konnte nicht erkannt werden
user_confirmed       → Nutzer hat OCR-Wert bestaetigt
user_overridden      → Nutzer hat anderen Wert eingetragen
```

**Neue Felder im fieldReviewStates-Objekt:**

```typescript
fieldReviewStates: {
  // Bestehende Felder (bleiben):
  date, time, amount, currency, supplier, invoiceNumber,
  location, paymentMethod, cardLastDigits, country, documentType,

  // Neue Felder:
  serviceDate,
  customerNumber,
  netAmount,
  taxBreakdown,
  grossAmount,
  invoiceAddress,
  lineItems
}
```

### Automatische Review-Trigger

| Situation | Aktion |
|-----------|--------|
| Alle Kernfelder "high" confidence | ReviewStatus bleibt DRAFT, Felder vorausgefuellt |
| Mindestens ein Kernfeld "low" oder "none" | Hinweis im UI: "Bitte Feld X pruefen" |
| Netto+MwSt ≠ Brutto | Warnhinweis im UI, Nutzer muss bestaetigen |
| Positionszeilen erkannt | Als Zusatzinfo anzeigen, kein Pflicht-Review |
| PDF war gescanntes PDF | Genereller Hinweis: "Scan-PDF - bitte alle Werte pruefen" |

### UI-Darstellung

**Desktop:**
- Bestehende Smart-Capture-Suggestions um Steuer-/Positionsbereich erweitern
- Felder mit "low" confidence: oranger Hintergrund + "unsicher"-Label
- Felder mit "none": leeres Feld + "nicht erkannt"-Hinweis
- Klick auf Confidence-Pill → Feld fokussieren zum Bearbeiten

**Mobil:**
- Kompaktere Darstellung der Confidence-Pills
- Swipe-Geste oder Tap zum Bestaetigen/Aendern
- Kritische Felder (Betrag, Datum) prominent oben

### Keine stillen Ueberschreibungen

Wenn der Nutzer ein Feld manuell aendert → `fieldReviewState` wechselt automatisch auf `user_overridden`. Das existiert bereits in der receipt-form.tsx Logik und muss nur auf die neuen Felder erweitert werden.

---

## 9. Datenmodell, API und UI

### 9.1 Datenmodell-Erweiterungen

**Neue Felder auf Receipt (Kernmodell):**

```prisma
model Receipt {
  // ... bestehende Felder ...

  // NEU: Rechnungsnummer als echtes DB-Feld
  // (bisher nur in ocrStructuredData, aber fuer Suche/Filter zu wichtig)
  invoiceNumber       String?   @db.VarChar(80)

  // NEU: Leistungsdatum (optional, da nicht jede Rechnung eins hat)
  serviceDate         DateTime? @db.Date

  // NEU: Steuerzerlegung
  netAmount           Decimal?  @db.Decimal(12, 2)
  taxAmount           Decimal?  @db.Decimal(12, 2)
  // grossAmount = amount (bestehend, bleibt Gesamtbetrag/Brutto)

  // Index fuer Suche nach Rechnungsnummer
  @@index([invoiceNumber])
  @@index([serviceDate])
}
```

**Begruendung - was Kernmodell wird:**

| Feld | Kernmodell? | Begruendung |
|------|-------------|-------------|
| `invoiceNumber` | Ja | Wird fuer Suche, Filter, Duplikaterkennung benoetigt |
| `serviceDate` | Ja | Steuerlich relevant, haeufig abgefragt |
| `netAmount` | Ja | Fuer Buchhaltung/DATEV essentiell |
| `taxAmount` | Ja | Fuer Buchhaltung/DATEV essentiell |
| MwSt-Aufschluesselung (mehrere Saetze) | Nein → JSON | Zu selten benoetigt, zu komplex fuer eigene Tabelle |
| Positionszeilen | Nein → JSON | Phase 1 Vorschlagsdaten, erst spaeter eigene Tabelle |
| Kundennummer | Nein → JSON | Kein Kernfeld fuer BelegBox-Workflow |
| Rechnungsadresse | Nein → JSON | Kein Kernfeld, nur Vorschlag |

**Erweiterung ocrStructuredData:**

Die neuen Invoice-Felder und Positionszeilen werden im bestehenden JSON-Feld gespeichert:

```typescript
ocrStructuredData: {
  // Bestehende Struktur bleibt:
  sourceType, extracted, fieldConfidence, special, specialConfidence, fieldReviewStates,

  // NEU:
  invoice: {
    serviceDate: string | null;
    servicePeriod: string | null;
    customerNumber: string | null;
    netAmount: number | null;
    taxLines: Array<{ rate: number; netAmount: number | null; taxAmount: number }>;
    grossAmount: number | null;
    invoiceAddress: string | null;
    lineItems: OcrInvoiceLineItem[];
  } | null;

  invoiceConfidence: {
    serviceDate: OcrConfidenceLevel;
    servicePeriod: OcrConfidenceLevel;
    customerNumber: OcrConfidenceLevel;
    netAmount: OcrConfidenceLevel;
    taxBreakdown: OcrConfidenceLevel;
    grossAmount: OcrConfidenceLevel;
    invoiceAddress: OcrConfidenceLevel;
    lineItems: OcrConfidenceLevel;
  } | null;
}
```

### 9.2 Prisma-Migration

```
Migration 1 (Phase B):
  ALTER TABLE Receipt ADD COLUMN invoiceNumber VARCHAR(80);
  ALTER TABLE Receipt ADD COLUMN serviceDate DATE;
  CREATE INDEX idx_receipt_invoice_number ON Receipt(invoiceNumber);
  CREATE INDEX idx_receipt_service_date ON Receipt(serviceDate);

Migration 2 (Phase C):
  ALTER TABLE Receipt ADD COLUMN netAmount DECIMAL(12,2);
  ALTER TABLE Receipt ADD COLUMN taxAmount DECIMAL(12,2);
```

### 9.3 API-Erweiterungen

**Bestehende Endpunkte erweitern:**

```
POST /api/receipts (Create)
PUT  /api/receipts/[id] (Update)
  → Akzeptieren: invoiceNumber, serviceDate, netAmount, taxAmount

GET /api/receipts (List)
  → Filter erweitern: invoiceNumber (Teiltext), serviceDate-Range
  → Sort erweitern: serviceDate

POST /api/ocr/analyze
  → Response erweitern: invoice-Block im OcrResult
```

**Keine neuen Endpunkte noetig.** Die bestehende API-Struktur (CRUD auf Receipt + OCR-Analyse) reicht aus.

### 9.4 Validierung

Erweiterung in `src/lib/validation.ts`:

```typescript
// Erweiterung receiptSchema:
invoiceNumber: z.string().max(80).optional(),
serviceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
netAmount: z.number().nonnegative().optional(),
taxAmount: z.number().nonnegative().optional(),

// Neue Refinement:
// Wenn netAmount und taxAmount gesetzt: netAmount + taxAmount ≈ amount (±0.05)
```

Erweiterung `ocrStructuredDataSchema` um `invoice` und `invoiceConfidence` Bloecke.

### 9.5 UI-Erweiterungen

**Receipt-Form (`receipt-form.tsx`):**

```
Neue Formular-Felder (nach bestehenden Feldern):
- Rechnungsnummer (Text-Input, vorausgefuellt aus OCR)
- Leistungsdatum (Datepicker, vorausgefuellt aus OCR)
- Nettobetrag (Dezimal-Input)
- MwSt-Betrag (Dezimal-Input)
- (Brutto = bestehender "Betrag")

Anzeige-Logik:
- Diese Felder nur anzeigen, wenn documentType != FUEL/PARKING/TOLL
  ODER wenn OCR invoice-Daten erkannt hat
- Oder: immer anzeigen, aber eingeklappt ("Rechnungsdetails ▸")
```

**Smart-Capture-Suggestions (`smart-capture-suggestions.tsx`):**

```
Neue Suggestion-Card "Rechnungsdaten":
- Netto / MwSt / Brutto als Zusammenfassung
- MwSt-Aufschluesselung (wenn mehrere Saetze)
- Plausibilitaets-Hinweis wenn Summe nicht stimmt
- Leistungsdatum / Kundennummer als Zusatzfelder

Neue Suggestion-Card "Rechnungspositionen" (optional, einklappbar):
- Tabelle mit Pos / Bezeichnung / Betrag
- Confidence-Badge pro Zeile
- Hinweis "Positionen sind Vorschlaege aus der PDF-Analyse"
```

**Receipt-Detail-Page (`receipts/[id]/page.tsx`):**

```
Erweiterung um:
- Rechnungsnummer anzeigen (wenn vorhanden)
- Leistungsdatum anzeigen (wenn vorhanden)
- Netto/MwSt/Brutto-Aufschluesselung anzeigen
- Positionszeilen anzeigen (aus ocrStructuredData, wenn vorhanden)
```

**Receipt-List (`receipt-list-page.tsx`):**

```
Erweiterung Filter:
- Rechnungsnummer (Teiltext-Suche)
- Leistungsdatum-Range
```

---

## 10. Umsetzungsphasen

### Phase A: Grundlagen (PDF-Pipeline-Erweiterung)

**Ziel:** Bestehende PDF-Pipeline robuster machen und fuer Rechnungsanalyse vorbereiten.

**Nutzen:** Bessere Erkennung bei allen PDF-Uploads, nicht nur Rechnungen.

**Technische Aenderungen:**
- `OcrSourceType` um `"pdf-mixed"` und `"pdf-error"` erweitern
- `MAX_PDF_SCAN_PAGES`: 3 → 5
- Per-Seite Text-Pruefung in `analyzePdf()` (gemischte PDFs)
- Differenzierte Fehlermeldungen (Passwort, korrupt)
- Seitenbezug im extrahierten Text (`PageText[]`)

**Dateien:** `src/lib/ocr.ts`, `src/lib/validation.ts` (OcrSourceType in Schema)

**Risiko:** Niedrig. Abwaertskompatible Erweiterung.

**Abhaengigkeiten:** Keine.

**Aufwand-Einschaetzung:** Klein

---

### Phase B: Rechnungsfeld-Parsing (Kernfelder)

**Ziel:** Rechnungsnummer, Leistungsdatum, verbesserte Lieferant-Erkennung.

**Nutzen:** Die wichtigsten Rechnungsfelder werden automatisch erkannt und vorbelegt.

**Technische Aenderungen:**
- Neue Extraktionsfunktionen: `extractServiceDate()`, `extractCustomerNumber()`
- Verbesserte `extractSupplier()` mit USt-ID-/Briefkopf-Heuristik
- Verbesserte `extractInvoiceNumber()` mit erweiterten Patterns
- Prisma-Migration: `invoiceNumber` und `serviceDate` auf Receipt
- API: Create/Update Receipt um neue Felder erweitern
- Validation: receiptSchema erweitern
- UI: Formularfelder fuer Rechnungsnummer und Leistungsdatum
- Smart-Capture-Suggestions: Neue Felder anzeigen

**Dateien:**
- `src/lib/ocr.ts` (Parsing-Logik)
- `prisma/schema.prisma` (Migration)
- `src/lib/validation.ts` (Schema)
- `src/app/api/receipts/route.ts` + `[id]/route.ts` (API)
- `src/components/receipts/receipt-form.tsx` (Formular)
- `src/components/receipts/smart-capture-suggestions.tsx` (Vorschlaege)
- `src/app/(dashboard)/receipts/[id]/page.tsx` (Detail)

**Risiko:** Mittel. Datenbank-Migration erforderlich.

**Abhaengigkeiten:** Phase A (Seitenbezug im Text).

**Aufwand-Einschaetzung:** Mittel

---

### Phase C: Netto / MwSt / Brutto

**Ziel:** Steuerzerlegung aus Rechnungen extrahieren.

**Nutzen:** Buchhaltungsrelevante Daten werden automatisch strukturiert.

**Technische Aenderungen:**
- Neue Extraktionsfunktionen: `extractNetAmount()`, `extractTaxBreakdown()`, `extractGrossAmount()`
- Plausibilitaetspruefung (Netto + MwSt = Brutto)
- Prisma-Migration: `netAmount` und `taxAmount` auf Receipt
- OcrResult/ocrStructuredData: `invoice.taxLines[]`
- API: Create/Update um Steuerfelder erweitern
- Validation: Kreuzpruefung Netto + MwSt ≈ Betrag
- UI: Steuerzerlegungs-Anzeige in Form und Detail
- Smart-Capture-Suggestions: Steuer-Card

**Dateien:** Gleiche wie Phase B + Steuer-spezifische UI-Komponenten

**Risiko:** Mittel. Betrags-Parsing ist fehleranfaellig bei unterschiedlichen Formaten.

**Abhaengigkeiten:** Phase B (Grundstruktur fuer invoice-Block).

**Aufwand-Einschaetzung:** Mittel

---

### Phase D: Positionszeilen (Basisversion)

**Ziel:** Rechnungspositionen als Vorschlagsdaten extrahieren.

**Nutzen:** Nutzer sieht Aufschluesselung der Rechnung, muss nicht PDF oeffnen.

**Technische Aenderungen:**
- Neue Funktion: `extractInvoiceLineItems(lines, pageTexts)`
- Tabellenheader-Erkennung
- Einfache Zeilen-Extraktion: Bezeichnung + Betrag
- Speicherung in `ocrStructuredData.invoice.lineItems[]`
- UI: Positionstabelle in Smart-Capture-Suggestions (einklappbar)
- UI: Positionstabelle in Receipt-Detail (einklappbar)

**Dateien:**
- `src/lib/ocr.ts` (Extraktionslogik)
- `src/components/receipts/smart-capture-suggestions.tsx` (Anzeige)
- `src/app/(dashboard)/receipts/[id]/page.tsx` (Anzeige)

**Risiko:** Hoch. Positionsextraktion ist komplex, Ergebnisse variieren stark.

**Abhaengigkeiten:** Phase A (Seitenbezug), Phase C (Plausibilitaet Positionen vs. Summe).

**Aufwand-Einschaetzung:** Mittel bis Gross

---

### Phase E: Laender-Erweiterung + Filter

**Ziel:** Mehr Laender erkennen, Filter/Suche erweitern.

**Nutzen:** Bessere Erkennung bei internationalen Rechnungen. Effizientere Suche.

**Technische Aenderungen:**
- COUNTRY_RULES erweitern (CH, IT, FR, CZ, PL, HU, SI, BA)
- Receipt-Liste: Filter nach Rechnungsnummer, Leistungsdatum
- Volltextsuche: `invoiceNumber` in Search einbeziehen

**Dateien:**
- `src/lib/ocr.ts` (Laender-Regeln)
- `src/components/receipts/receipt-list-page.tsx` (Filter)
- `src/app/api/receipts/route.ts` (Suche/Filter)

**Risiko:** Niedrig.

**Abhaengigkeiten:** Phase B (invoiceNumber als DB-Feld).

**Aufwand-Einschaetzung:** Klein

---

### Phase F: Feinschliff / Robustheit

**Ziel:** Edge Cases abfangen, UX optimieren, Performance sichern.

**Nutzen:** Stabilere Erkennung, weniger manuelle Korrekturen.

**Technische Aenderungen:**
- Mehrseitige Tabellen (fortgesetzter Header)
- Verbesserte Positionsextraktion (Menge, Einzelpreis, Einheit)
- Performance-Optimierung bei grossen PDFs
- Duplikaterkennung (gleiche Rechnungsnr. + Lieferant)
- Bessere Fehlermeldungen und Hinweise
- DATEV-Export: Rechnungsnummer/Leistungsdatum in PDF/Mail einbeziehen

**Dateien:** Alle aus vorherigen Phasen.

**Risiko:** Niedrig bis mittel.

**Abhaengigkeiten:** Alle vorherigen Phasen.

**Aufwand-Einschaetzung:** Mittel (laufend)

---

## 11. Risiken und Stolperstellen

### Technische Risiken

| Risiko | Auswirkung | Gegenmassnahme |
|--------|------------|----------------|
| **Textbasiert vs. gescannt** | Gescannte PDFs liefern 30-50% schlechtere OCR-Ergebnisse | Immer Confidence anzeigen, bei Scan-PDFs generellen Warnhinweis |
| **OCR-Fehler bei Scan-PDFs** | Falsche Betraege, vertauschte Ziffern (z.B. "1" vs "l") | Plausibilitaetspruefungen, Nutzer muss bei low-confidence bestaetigen |
| **Unterschiedliche Rechnungslayouts** | Heuristiken greifen nicht bei ungewoehnlichen Layouts | Fallback auf manuelle Eingabe, keine stille Fehlzuordnung |
| **Mehrseitige Tabellen** | Positionszeilen werden abgeschnitten oder doppelt erkannt | Seiten-Limit auf 5, Seitenumbruch-Erkennung in Phase F |
| **Falsche Betragszuordnung** | Netto/Brutto verwechselt, falscher MwSt-Satz | Plausibilitaetspruefung, Kreuzcheck, Review-Pflicht bei Widerspruch |
| **Falsche Rechnungsnummern** | Kundennummer oder Bestellnummer statt Rechnungsnummer erkannt | Separate Keyword-Listen, Confidence-Level, kein Auto-Commit |
| **Performance bei grossen PDFs** | Tesseract.js ist langsam (5-15s pro Seite) | Max 5 Seiten OCR, Textbasierte PDFs bevorzugen, Loading-Indicator |
| **Speicherverbrauch** | PDF-Rendering + OCR braucht RAM | Seiten sequentiell verarbeiten, Buffer nach Verarbeitung freigeben |

### Fachliche Risiken

| Risiko | Auswirkung | Gegenmassnahme |
|--------|------------|----------------|
| **Fremdsprachige Rechnungen** | Keywords "Rechnung"/"MwSt" greifen nicht | Englische Fallback-Keywords immer mitpruefen, Laender-spezifische Keywords |
| **Kleinunternehmer-Rechnungen** | Keine MwSt ausgewiesen | Steuerzerlegung optional, "keine MwSt erkannt" als gueltig behandeln |
| **Gutschriften** | Negative Betraege, anderes Layout | Als eigener Fall behandeln (spaeter), vorerst wie normale Rechnung parsen |
| **Proforma-Rechnungen** | Nicht buchungsrelevant, aber gleiches Format | Kein spezieller Umgang noetig, Nutzer entscheidet |

### Datenschutz / Sicherheit

| Aspekt | Bewertung | Massnahme |
|--------|-----------|-----------|
| **PDF-Inhalte** | Rechnungen enthalten geschaeftliche Daten | Keine externe API, alles lokal (Tesseract.js + pdf-parse) |
| **OCR-Rohdaten** | ocrRawText enthaelt den gesamten Text | Nur serverseitig gespeichert, kein Zugriff fuer andere Nutzer |
| **Positionsdaten** | Koennen sensible Geschaeftsinformationen enthalten | In ocrStructuredData (JSON), gleicher Zugriffsschutz wie Receipt |
| **Original-PDF** | Unveraendert gespeichert | Bereits geloest via ReceiptFile, Dateisystem-Zugriff per userId |

---

## 12. Zusammenfassung und Priorisierung

### Was sofort gebaut werden sollte (Phase A + B)

1. **PDF-Pipeline robuster machen** (Phase A)
   - Gemischte PDFs erkennen
   - Seiten-Limit auf 5
   - Differenzierte Fehlermeldungen
   - Seitenbezug im Text

2. **Rechnungsnummer + Leistungsdatum als echte Felder** (Phase B)
   - DB-Migration fuer `invoiceNumber` und `serviceDate`
   - Verbesserte Extraktion
   - Formularfelder + Vorschlaege im UI

### Was in einer zweiten Ausbaustufe kommen sollte (Phase C + D)

3. **Netto/MwSt/Brutto-Zerlegung** (Phase C)
   - Steuerextraktion mit Plausibilitaetspruefung
   - DB-Felder `netAmount`, `taxAmount`
   - MwSt-Aufschluesselung in ocrStructuredData
   - UI-Darstellung der Steuerzerlegung

4. **Positionszeilen als Vorschlagsdaten** (Phase D)
   - Einfache Extraktion: Bezeichnung + Betrag
   - Nur in ocrStructuredData, keine eigene DB-Tabelle
   - Einklappbare Anzeige im UI

### Was nur optional/spaeter kommen sollte

5. **Laender-Erweiterung** (Phase E) - nice-to-have
6. **Erweiterte Positionsextraktion** (Menge/Einheit/Einzelpreis) - spaeter
7. **Eigene DB-Tabelle InvoiceLineItem** - erst wenn Qualitaet stimmt
8. **Mehrseitige Tabellenextraktion** - komplex, spaeter
9. **Duplikaterkennung** (gleiche Rechnungsnr.) - spaeter
10. **Gutschrift-Erkennung** - spaeter

### Codex-Auftraege (konkrete Umsetzungsschritte)

Nach Freigabe dieses Konzepts kann Codex folgende Auftraege erhalten:

**Auftrag 1 (Phase A):**
```
Erweitere src/lib/ocr.ts:
- OcrSourceType um "pdf-mixed" und "pdf-error"
- MAX_PDF_SCAN_PAGES auf 5
- analyzePdf(): Per-Seite Text-Pruefung, gemischte PDFs
- Differenzierte Fehlermeldungen (Passwort, korrupt)
- Interner PageText-Typ mit Seitenbezug
Erweitere src/lib/validation.ts:
- ocrStructuredDataSchema: sourceType um neue Werte
```

**Auftrag 2 (Phase B - DB + API):**
```
Prisma-Migration:
- Receipt: invoiceNumber (VARCHAR 80, nullable, indexed)
- Receipt: serviceDate (DATE, nullable, indexed)

API-Erweiterung:
- POST/PUT /api/receipts: invoiceNumber und serviceDate akzeptieren
- GET /api/receipts: Filter nach invoiceNumber (ILIKE), serviceDate-Range

Validation:
- receiptSchema: invoiceNumber (string, max 80, optional)
- receiptSchema: serviceDate (ISO date string, optional)
```

**Auftrag 3 (Phase B - Parsing):**
```
Erweitere src/lib/ocr.ts:
- extractServiceDate(text): Keywords Leistungsdatum/Leistungszeitraum/Lieferdatum
- extractCustomerNumber(lines): Keywords Kundennr/Kunden-Nr/Customer
- extractSupplier() verbessern: USt-ID-Heuristik, Briefkopf-Erkennung
- extractInvoiceNumber() erweitern: Zusaetzliche Patterns (Re.Nr., Faktura)
- OcrResult erweitern um invoice-Block
- parseReceiptText() erweitern um neue Felder
```

**Auftrag 4 (Phase B - UI):**
```
receipt-form.tsx:
- Felder Rechnungsnummer (Text) und Leistungsdatum (Datepicker)
- Vorbefuellung aus OCR-Ergebnis
- Override-Tracking fuer neue Felder

smart-capture-suggestions.tsx:
- Rechnungsnummer und Leistungsdatum in Vorschlaegen anzeigen
- Confidence-Pills fuer neue Felder

receipts/[id]/page.tsx:
- Rechnungsnummer und Leistungsdatum in Detailansicht
```

**Auftrag 5 (Phase C):**
```
Erweitere src/lib/ocr.ts:
- extractNetAmount(text, lines)
- extractTaxBreakdown(text, lines)
- extractGrossAmount(text, lines)
- Plausibilitaetspruefung: Netto + MwSt ≈ Brutto

Prisma-Migration:
- Receipt: netAmount DECIMAL(12,2), nullable
- Receipt: taxAmount DECIMAL(12,2), nullable

API + Validation + UI analog zu Phase B.
```

**Auftrag 6 (Phase D):**
```
Erweitere src/lib/ocr.ts:
- extractInvoiceLineItems(lines, pageTexts)
- Tabellenheader-Erkennung
- OcrInvoiceLineItem-Typ

UI:
- Einklappbare Positionstabelle in smart-capture-suggestions.tsx
- Einklappbare Positionstabelle in receipts/[id]/page.tsx
```

---

### Architektur-Diagramm: Erweiterte Pipeline

```
                    PDF Upload
                        │
                        ▼
                ┌───────────────┐
                │  analyzePdf() │  ← Erweitert: gemischt, Fehler
                └───────┬───────┘
                        │
            ┌───────────┼───────────┐
            ▼           ▼           ▼
        pdf-text    pdf-mixed    pdf-scan
            │           │           │
            └─────┬─────┘           │
                  │                 │
                  ▼                 ▼
            Text (mit          OCR pro Seite
            Seitenbezug)       (Tesseract.js)
                  │                 │
                  └────────┬────────┘
                           │
                           ▼
                  ┌─────────────────┐
                  │ parseReceiptText│  ← Erweitert
                  └────────┬────────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
         Basisfelder   Steuer-     Positions-
         (existiert)   zerlegung   zeilen
              │        (Phase C)   (Phase D)
              │            │            │
              └────────────┼────────────┘
                           │
                           ▼
                    ┌────────────┐
                    │  OcrResult │  ← Erweitert um invoice-Block
                    └──────┬─────┘
                           │
                           ▼
                    ┌────────────┐
                    │ Receipt    │  ← Neue Felder + ocrStructuredData
                    │ Form / UI  │
                    └────────────┘
```
