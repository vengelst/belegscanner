# BelegBox - Smart Capture

Stand: 2026-04-02

## Zielbild bis Phase 5

Smart Capture erweitert den bestehenden Upload- und Receipt-Flow, statt eine zweite Erfassungsschiene aufzubauen.
Originaldateien bleiben unveraendert gespeichert. Verarbeitete Bilder und OCR-Vorschlaege bleiben getrennte Arbeitsdaten.

## Aktueller Funktionsstand

### Phase 1
- Mobile Kameraaufnahme in der Web-App
- Manueller Capture mit Vorschau und Uebernahme
- Integration in den bestehenden Upload-/OCR-/Receipt-Flow
- Getrennte Arbeitskopie fuer Vorschau und OCR

### Phase 2
- Dokumentenerkennung im Kamerafeed
- Qualitaetspruefung vor Auto-Capture
- Konservatives Auto-Capture mit Hold-Zeit
- Verbesserte Crop-/Rotationsvorbereitung fuer die OCR-Arbeitskopie

### Phase 3
- Strukturierte OCR-Feldzuordnung fuer Kernfelder
- Belegtyp-Erkennung fuer general, fuel, hospitality, lodging
- Erste Spezialparser fuer Tanken und Bewirtung
- Speicherung strukturierter OCR-Vorschlaege in `ocrStructuredData`

### Phase 4
- Laendererkennung ueber Waehrung, Ort, Adressmuster und weitere Signale
- Robustere Erkennung fuer Zahlungsart und Kartenendziffern
- Feldstatusmodell fuer OCR sicher / unsicher / nicht erkannt / manuell bestaetigt / manuell gesetzt
- Review-UX fuer kritische OCR-Felder

### Phase 5
- Robuste Belegtypen fuer `lodging`, `parking` und `toll`
- Typ-spezifische Zusatzdaten und Positionshinweise
- Typ-spezifische Review-Karten in Erfassung und Detailansicht
- Smart Capture fuer einen ersten echten internen Praxiseinsatz abgerundet

## Unterstuetzte Belegtypen

- `general`: allgemeiner Beleg ohne weitere Spezialisierung
- `fuel`: Tankbeleg
- `hospitality`: Bewirtungsbeleg
- `lodging`: Unterkunft / Hotel
- `parking`: Parkbeleg
- `toll`: Mautbeleg

## Strukturierte OCR-Vorschlaege

Allgemeine Vorschlaege:
- Datum
- Uhrzeit
- Lieferant / Anbieter
- Ort / Standort
- Betrag
- Waehrung
- Land
- Zahlungsart
- Kartenendziffern
- Belegtyp

Typ-spezifische Vorschlaege:
- `fuel`: Liter, Preis pro Liter, Kraftstoffart
- `hospitality`: Ort, Zwischensumme, Trinkgeld, Positionshinweise
- `lodging`: Ort, Naechte, Zwischensumme, Tax/Kurtaxe, Gebuehren, Zusatzpositionen
- `parking`: Ort, Dauer, Einfahrt, Ausfahrt
- `toll`: Station / Anbieter, Streckenhinweis, Fahrzeugklasse

## Review- und Merge-Regeln

- OCR-Vorschlaege bleiben immer Vorschlaege.
- Manuelle Eingaben haben immer Vorrang.
- OCR darf bestaetigte oder manuell gesetzte Werte nicht still ueberschreiben.
- Feldstatus werden leichtgewichtig pro wichtigem Feld gefuehrt.
- Unsichere Spezialdaten duerfen leer bleiben; der Kernflow muss trotzdem funktionieren.

## Bewusst offene Grenzen

- Keine Vollautomatik ohne Nutzerreview
- Keine globale Speziallogik fuer exotische internationale Formate
- Keine manuelle Crop-/Nachkorrektur-UI in Smart Capture selbst
- Noch keine weitergehende Perspektivkorrektur mit Vierpunkt-Entzerrung
- Spezialparser bleiben heuristisch und konservativ
