# Claude Code – Beleg: leeres Formular + Positionen deaktivieren

## Kontext

Repo: `/Users/volkhardengelstadter/coding/belegscanner`  
Prod: vivahome.de, Pfad `/opt/belegscanner`, `docker-compose.prod.yml`

Zwei Features jetzt (Scanner-Erkennung kommt später separat):

### Feature A – Neuer Beleg startet leer
Problem: Nach „Speichern & nächsten“ (und generell) bleiben Felder vom vorherigen Beleg stehen (React-State ohne Remount) + Zuordnung aus `localStorage` (`belegbox.receipts.last-selection.v1`). Der User muss alles durchklicken. Vorbelegung soll **nicht** vom vorherigen Beleg kommen – Inhalte kommen später aus der Belegerkennung (Schritt 2).

### Feature B – Positionen ausnehmen / inaktiv
Rechnungen haben oft mehrere Positionen; manche gehören nicht zur Firma. User muss Positionen **entfernen oder inaktiv schalten**. Dann **Bruttobetrag + MwSt/Netto neu berechnen** aus den aktiven Positionen.

---

## Feature A – Anforderungen

1. Nach erfolgreichem Speichern mit `save_next`: Formular **vollständig zurücksetzen** (Datei, Preview, OCR, Datum auf heute, Beträge, Lieferant, Rechnungsnr., Hospitality, Overrides, partyRole, Fehler, Duplikat-State).
2. Zuordnung (Zweck/Kategorie/Land/Kfz): **nicht** aus dem vorherigen Beleg (`persistLastSelections` / `readLastSelections`).  
   - Entweder Session-Prefill komplett entfernen **oder** bei neuem Beleg / `save_next` nicht anwenden.  
   - User-Defaults aus den Einstellungen (`userDefaults`) dürfen bleiben, wenn sie nicht „letzter Beleg“ sind – aber **kein** Badge/Text „letzte Erfassung“.  
   - Bevorzugt: Session-Last-Selection **abschaffen** (schreiben + lesen entfernen), Defaults aus Settings behalten.
3. Soft-Navigation `/receipts/new?continued=1` remountet oft nicht → **Remount erzwingen** (`key` am `ReceiptForm` aus Timestamp/Query) **und/oder** explizite `resetForm()` im Client nach `save_next`.
4. Banner „Fortsetzung“ anpassen: klarstellen, dass Felder leer starten und der nächste Beleg erkannt werden soll (kein Übernehmen vom Vorgänger).
5. Edit-Flow (`receipt-edit-form`) unverändert (lädt aus DB).

Relevante Dateien:
- `src/components/receipts/receipt-form.tsx`
- `src/hooks/useSelectionPrefill.ts`
- `src/lib/receipts/form-helpers.ts` (`persistLastSelections`, `resolveSelectionState`)
- `src/components/receipts/receipt-form-assignment-section.tsx`
- `src/app/(dashboard)/receipts/new/page.tsx`

---

## Feature B – Anforderungen

Positionen leben in `ocrResult.special.invoice.lineItems` (und ggf. hospitality/lodging `lineItems`) – **kein** Prisma-Modell. Betrag/MwSt am Receipt: `amount` / `netAmount` / `taxAmount` via `splitGrossByVatRate`.

1. UI an Rechnungspositionen (Create + Edit + ggf. Detail): je Position Button **„Nicht übernehmen“ / Inaktiv** (Toggle). Inaktive Positionen optisch durchgestrichen/ausgegraut, aber sichtbar.
2. Bei Toggle: Summe der **aktiven** `totalPrice` (Invoice) bzw. `amount` (simple LineItems) → `setAmount` → bestehende MwSt-Logik (`splitGrossByVatRate` + Land / Reverse Charge) neu anwenden. Manuelle Overrides für amount/net/tax entsprechend setzen, damit OCR-Prefill nicht zurückschreibt.
3. Wenn keine Position einen Betrag hat: Betrag nicht blind auf 0 setzen ohne Hinweis; wenn alle inaktiv → Betrag 0 + Steuer/Netto 0 (oder klarer Hinweis).
4. Persistenz: in `aiStructuredData` speichern, welche Positionen excluded/inactive sind (z. B. Feld `excluded: boolean` pro Item **oder** parallele `excludedLineIndexes`). Beim Speichern nur aktive in die „gültige“ Liste **oder** alle behalten + Flag – Flag bevorzugen, damit Edit sie wieder aktivieren kann.
5. Gleiche Steuerung im Edit-Formular, wenn Structured Data Positionen hat; PATCH speichert aktualisierte `aiStructuredData` + Beträge.
6. Detail-Ansicht: inaktive Positionen als solche kennzeichnen (optional, wenn wenig Aufwand).

Relevante Dateien:
- `src/components/receipts/smart-capture-suggestions.tsx` (`InvoiceLineItemList`, `LineItemList`)
- `src/components/receipts/receipt-form.tsx` + OCR-Prefill-Hook
- `src/components/receipts/receipt-edit-form.tsx`
- `src/lib/document-analysis.ts` (optional `excluded?: boolean` am LineItem-Typ)
- `src/lib/receipts/form-helpers.ts` – Helper `sumActiveLineItems` / Recalc
- `src/components/receipts/detail/receipt-ocr-section.tsx`

---

## Nicht jetzt

- Keine Verbesserung der Scanner-/KI-Erkennung (kommt als Schritt 2)
- Kein neues Prisma-`ReceiptLineItem`-Modell
- Keine Buchhaltungs-Export-Änderungen außer korrekte Betragsfelder am Receipt

---

## Done wenn

1. Neuer Beleg / „Speichern & nächsten“: Belegdatenfelder leer (oder nur User-Defaults für Zuordnung, nie Daten des Vorgänger-Belegs).
2. Positionen lassen sich inaktiv schalten; Brutto + Netto + MwSt stimmen zur Summe der aktiven Positionen.
3. TypeScript/Lint sauber für geänderte Dateien.
4. Commit auf `main` mit klarer Message. Push/Deploy macht Cursor danach.

Deutsch in UI-Texten.
