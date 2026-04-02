# BelegBox - Phase 2 (Paket 14)

> Hinweis: ZWISCHENSTAND: Paket-/Ausbaustand aus einer frueheren Projektphase. Inhalte koennen vom aktuellen Produktstand abweichen.


Stand: 2026-04-02
Version: 1.1.0

---

## Uebersicht

Phase 2 erweitert das MVP um Reporting, CSV-Export, verbesserte OCR und Komfortfunktionen fuer den Alltag.

## Neue Funktionen

### Reporting (Admin)

Route: `/admin/reports`
API: `GET /api/reports/summary`

Auswertungen:
- Belege gesamt, Summe Original, Summe EUR, Versandfehler
- Aufschluesselung nach Status, Benutzer, Land, Zweck, Kategorie
- Jede Gruppe zeigt Anzahl und EUR-Summe
- Zeitraumfilter (von/bis)
- Desktop-optimiertes Tabellen-Layout

### CSV-Export (Admin)

Route: `GET /api/receipts/export`
UI: "CSV-Export"-Button in der Belegliste (nur fuer Admins)

Export enthaelt:
- Datum, Lieferant, Betrag, Waehrung, EUR-Betrag, Wechselkurs
- Zweck, Kategorie, Land, Kfz, Benutzer, Status
- Bemerkung, Erstellt-Datum
- Semikolon-getrennt, UTF-8 mit BOM (Excel-kompatibel)
- Exportiert den aktuellen Filterzustand

### Verbesserte OCR

- Keyword-basierte Datumserkennung (Rechnungsdatum, Belegdatum)
- Total-Keyword-Erkennung (Summe, Gesamt, Brutto, zu zahlen)
- Waehrungserkennung nahe Betraegen (EUR, CHF, RSD + 12 weitere Codes)
- Rauschfilter fuer Lieferant (Tel, Fax, USt, MwSt-Zeilen werden uebersprungen)
- Konfidenz-Anzeige pro Feld (hoch/mittel/niedrig)
- Felder mit hoher Konfidenz werden direkt uebernommen, unsichere gekennzeichnet

### Komfortverbesserungen

- OCR-Ergebnisse fliessen automatisch in kontrollierte Formularfelder (useEffect-Sync)
- Betragsfelder zeigen Komma als Dezimaltrennzeichen im Edit-Formular
- Admin-Navigation um Reporting erweitert

## Technische Details

### Reporting-API

Prisma `groupBy` mit `_count` und `_sum` fuer aggregierte Abfragen. Separate Queries fuer jede Dimension, aufgeloest per `Promise.all`. Benutzernamen und Stammdaten-Namen werden ueber eine zweite Query aufgeloest.

### CSV-Export

Server-side CSV-Generierung mit BOM-Prefix fuer Excel-UTF-8-Kompatibilitaet. Semikolon als Trennzeichen (europaeischer Standard). Betraege mit Komma als Dezimaltrennzeichen. Aktueller Filterzustand wird als Query-Parameter weitergereicht.

### OCR-Verbesserung

Neue interne Typen `FieldResult<T>` mit `value` und `confidence`. Keyword-Proximity-Erkennung fuer Datum und Betrag. Noise-Filter fuer Lieferant-Erkennung. Rueckwaertskompatibel -- das `OcrResult`-Interface erweitert (nicht geaendert), `fieldConfidence` ist ein neues optionales Feld.

## Neue Dateien

| Datei | Zweck |
|---|---|
| src/app/api/reports/summary/route.ts | Reporting-API |
| src/app/(dashboard)/admin/reports/page.tsx | Reporting-Seite |
| src/components/admin/reporting-dashboard.tsx | Reporting-UI mit KPIs und Tabellen |
| src/app/api/receipts/export/route.ts | CSV-Export-API |

## Geaenderte Dateien

| Datei | Aenderung |
|---|---|
| src/lib/ocr.ts | Keyword-Erkennung, Konfidenz, Noise-Filter |
| src/components/receipts/receipt-form.tsx | Konfidenz-Anzeige, OcrField-Komponente |
| src/components/receipts/receipt-list-page.tsx | CSV-Export-Button |
| src/components/admin/admin-shell.tsx | Reporting-Link in Navigation |
