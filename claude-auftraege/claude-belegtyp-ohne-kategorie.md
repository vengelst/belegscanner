# Claude Code – Kategorie raus, DATEV-Belegtyp aus OCR + Firmenkarten

## Kontext

Repo: `/Users/volkhardengelstadter/coding/belegscanner`  
Prod: beleg.vivahome.de, `/opt/belegscanner`

Bereits live: `DatevBelegtyp`, Upload-Mail-Adressen je Typ, `suggestDatevBelegtyp` (heute noch über Kategorie-Namen).

### Produktentscheidung (verbindlich)

1. **Kategorie aus der UI entfernen** – Nutzer sieht und pflegt nur noch **DATEV-Belegtyp**.  
   Schema `Category`/`categoryId` vorerst **intern behalten** (NOT NULL): serverseitig still auf eine Default-Kategorie mappen, damit Migration klein bleibt. Kein Admin-Zwang mehr, Kategorie zu wählen. Filter „Kategorie“ in der Liste entfernen oder durch Belegtyp-Filter ersetzen.

2. **Belegtyp wird beim Scan erkannt** und vorbelegt (manuell überschreibbar).

3. **Firmenkarten-Endziffern** in Einstellungen (Organisation):
   - Initial / Seed: `2454` (Sparkasse), `2350` (Apple Wallet)
   - OCR `cardLastDigits` matcht eine dieser Endungen → `KREDITKARTENBELEGE`
   - Andere erkannte Kartenendziffern / unbekannte Karte → `KASSE`  
     (privat bezahlt, Erstattung über Barkasse)
   - Keine Karte, aber Bar/Kasse-Kontext → `KASSE`

### Erkennungsregeln (Priorität von oben nach unten)

```
1. partyRole === DEBTOR (Rechnung von Viva Home / Ausgang) → RECHNUNGSAUSGANG
2. paymentMethod credit_card/visa/mastercard/debit_card ODER cardLastDigits vorhanden:
   - cardLastDigits endet mit / gleich einer Firmenkarten-Endziffer → KREDITKARTENBELEGE
   - sonst (andere Karte oder Ziffern unbekannt) → KASSE
3. paymentMethod === cash → KASSE
4. documentType hospitality / Bewirtung → RECHNUNGSEINGANG
5. sonst (Eingangsrechnung etc.) → RECHNUNGSEINGANG
6. wirklich unklar (kein partyRole, kein payment, schwache Daten) → SONSTIGE
```

`suggestDatevBelegtyp` in `src/lib/datev/belegtyp.ts` **umschreiben**: Parameter `{ partyRole, paymentMethod, cardLastDigits, documentType, companyCardLastDigits: string[] }` – **keine Category mehr**.

Beim OCR-Prefill / nach Analyse: Belegtyp setzen, solange User ihn nicht manuell überschrieben hat (bestehendes Override-Muster beibehalten).

---

## Einstellungen: Firmenkarten

Neuen Speicherort (eine der Varianten, klar und einfach):

**Empfohlen:** am `OrganizationProfile` JSON/Array oder Textfeld:

```prisma
companyCardLastDigits  String[]  @default([])
// oder: String @db.Text  mit kommagetrennten 4-stelligen Endungen
```

Admin UI unter Organisation (oder eigene kleine Card in Settings/Admin):
- Liste der Endziffern (4 Stellen), hinzufügen/entfernen
- Vorbelegt mit `2454`, `2350` nach Migration/Seed
- Validierung: nur Ziffern, Länge 2–4 (OCR liefert oft 4)

Hilfsfunktion: `matchesCompanyCard(cardLastDigits, companyList)` – Normalisierung (nur Digits, Suffix-Match: OCR „54“ matcht „2454“ nur wenn klar; bevorzugt exakt 4 gegen 4).

Sicherheit: **keine vollen PANs speichern**, nur Endziffern.

---

## Kategorie UI entfernen

- Create/Edit: Dropdown Kategorie weg; `categoryId` im Body serverseitig aus Default (erste aktive Category oder feste Seed-ID „Kasse“/„Sonstiges“) setzen – egal welcher Name, nur FK erfüllen.
- User-Defaults: `defaultCategoryId` aus Settings-UI entfernen.
- Assignment-Section Texte anpassen (nur Belegtyp).
- Filter-Bar: Category-Filter → **DATEV-Belegtyp-Filter**.
- Liste/Detail/Print: Kategorie-Anzeige durch Belegtyp ersetzen wo sinnvoll.
- DATEV-PDF: Label „Zahlungsart“ nicht mehr aus Category; Belegtyp anzeigen.
- Mail-Template: `{category}` optional deprecated; `{belegtyp}` bleibt.
- Admin „Kategorien“-Seite: aus Navigation entfernen oder als „veraltet“ markieren (nicht löschen Schema).

---

## OCR-Anbindung

Nach `analyze` / `useOcrPrefill`:
- `partyRole`, `paymentMethod`, `cardLastDigits`, `documentType` aus Ergebnis lesen
- Firmenkarten aus Organization laden (API analyze kann Org mitgeben, oder Client lädt Settings)
- `setDatevBelegtyp(suggest(...))` wenn nicht manuell

Prompt-Hinweis (klein, in organization-prompt):  
Kartenendziffern möglichst 4-stellig extrahieren; paymentMethod sauber setzen.

---

## Tests

- Unit-Tests für neue `suggestDatevBelegtyp`-Matrix (Firmenkarte 2454/2350 → Kreditkarte; 9999 → Kasse; DEBTOR → Ausgang; hospitality → Eingang; cash → Kasse).
- Bestehende Category-abhängige Tests anpassen.

---

## Nicht in diesem Auftrag

- Keine harte Prisma-Löschung von `Category`
- Keine große Scanner-Genauigkeits-Überarbeitung (folgt separat) – nur so viel Prompt/Prefill, dass Belegtyp aus vorhandenen OCR-Feldern greift

---

## Done wenn

1. UI ohne Kategorie-Pflicht; Belegtyp Pflicht/zentral.
2. Firmenkarten 2454, 2350 in Org-Settings + Migration/Seed.
3. Suggestion-Regeln wie oben, getestet.
4. Filter nach Belegtyp.
5. Commit auf `main`. Deploy/Migrate macht Cursor.

Deutsch in UI.
