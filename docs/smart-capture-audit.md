# BelegBox - Smart-Capture-Audit

Stand: 2026-04-02

## Gesamturteil

Smart Capture ist im aktuellen Ausbauzustand technisch konsistent in den bestehenden Receipt-/OCR-Flow integriert. Der Kernpfad Kamera -> Vorschau -> OCR -> Feldvorschlaege -> Review -> Speichern -> Detailansicht funktioniert aus Code- und Build-Sicht durchgaengig. Der Stand ist intern testfaehig, staging-faehig und fuer einen ersten echten internen Praxiseinsatz geeignet.

Es gibt aktuell keine kritischen Code- oder Build-Blocker. Die verbleibenden Restpunkte liegen vor allem in der Robustheit heuristischer Spezialparser, in bewusst konservativen Erkennungsgrenzen und in der noch schlanken manuellen Review-Unterstuetzung fuer typ-spezifische Zusatzdaten.

## Phase A - Ist-Zustand

### Vorhandene Smart-Capture-Funktionen

- Mobile Kameraaufnahme in der Web-App
- Manueller Capture mit Review-Schritt
- Dokumentenerkennung im Livebild
- Qualitaetspruefung und konservatives Auto-Capture
- OCR-Arbeitskopie mit Crop-, Rotations- und Kontrastverbesserung
- Trennung zwischen Originaldatei und verarbeiteter OCR-Version
- OCR fuer Bilder und PDFs
- Strukturierte OCR-Feldzuordnung
- Belegtyp-Erkennung fuer `general`, `fuel`, `hospitality`, `lodging`, `parking`, `toll`
- Spezialparser fuer Tanken, Bewirtung, Unterkunft, Parken und Maut
- Laender-, Zahlungsart- und Kartenendziffern-Erkennung
- Feldstatus-/Review-Logik
- Typ-spezifische Review-Karten in Erfassung und Detailansicht

### Reifegrad der Phasen 1 bis 5

- Phase 1: vollstaendig vorhanden
- Phase 2: weitgehend vorhanden, aber Perspektivkorrektur nur teilweise
- Phase 3: vorhanden und produktiv integriert
- Phase 4: vorhanden und konsistent integriert
- Phase 5: vorhanden, aber typ-spezifische Zusatzdaten bleiben bewusst heuristische Review-Hinweise

### Doppelstrukturen / Altpfade

- Keine zweite Kamera- oder OCR-Welt gefunden
- Upload und Kamera laufen durch denselben Receipt-Flow
- `ocrStructuredData` ist der zentrale Persistenzpfad fuer strukturierte OCR-Hinweise

### Doku-Code-Abweichungen

- `docs/mvp-abnahme.md` war veraltet und nannte PDF-OCR noch als nicht umgesetzt
- Diese Doku-Abweichung wurde direkt korrigiert

## Phase B - Kernpfad

### Gepruefter Zielpfad

- Neuer Beleg
- Kamera oeffnen oder Datei-Upload
- Manueller Capture oder Auto-Capture
- Vorschau / Review
- OCR-Arbeitskopie erzeugen
- OCR ausfuehren
- Strukturierte Vorschlaege anzeigen
- Typvorschlag und Zusatzhinweise anzeigen
- Manuelle Korrektur im bestehenden Formular
- Speichern
- Detailansicht mit Smart-Capture-Nachvollziehbarkeit
- Versand / Druck bleiben auf dem Originalpfad nutzbar

### Bewertung

- Kameraaufnahme: vorhanden und sauber gekapselt
- Manueller Fallback: vorhanden
- Auto-Capture: konservativ und mit Hold-/Cooldown-Logik abgesichert
- Vorverarbeitung: vorhanden, aber noch ohne echte Vierpunkt-Entzerrung
- Original vs. verarbeitet: sauber getrennt
- OCR-Integration: zentral, ohne Parallelpfad
- Persistenz: strukturiert ueber `ocrStructuredData`
- Detailansicht: Vorschlaege und Status nachvollziehbar sichtbar
- Versand / Druck: keine Kopplung an Smart-Capture-Arbeitsdaten gefunden

## Phase C - Typspezifische Bewertung

### `general`

- Erkennung: Fallback, wenn kein Spezialtyp ausreichend sicher erkannt wird
- Robuste Felder: Datum, Betrag, Waehrung, Lieferant
- Teilweise / unsicher: Ort, Land, Zahlungsart, Kartenendziffern
- Manuell zu bestaetigen: fachliche Zuordnung und alle unsicheren OCR-Werte

### `fuel`

- Erkennung: Keyword-Score plus Liter/Preis pro Liter/Kraftstoffart
- Robuste Felder: Gesamtbetrag haeufig, Liter und Kraftstoffart bei klaren Belegen
- Teilweise / unsicher: Preis pro Liter je nach Layout/OCR-Qualitaet
- Manuell zu bestaetigen: alle Tankhinweise bleiben Vorschlaege

### `hospitality`

- Erkennung: Restaurant-/Bewirtungssignale plus Tip/Positionshinweise
- Robuste Felder: Anbieter, Datum, Betrag oft brauchbar; Ort/Trinkgeld/Zwischensumme teils brauchbar
- Teilweise / unsicher: Positionen und Detailwerte je nach Layout
- Immer manuell: Anlass, Gaeste/Teilnehmer und finale Bewirtungsangaben

### `lodging`

- Erkennung: Hotel-/Unterkunfts-Keywords plus Naechte/Tax/Unterkunftspositionen
- Robuste Felder: Anbieter, Betrag, Waehrung oft; Naechte oder Tax nur bei klaren Mustern
- Teilweise / unsicher: Gebuehren, Zusatzpositionen, Aufenthaltsdetails
- Manuell zu bestaetigen: alle Unterkunfts-Zusatzhinweise

### `parking`

- Erkennung: Parkhaus-/Parking-/Einfahrt-/Ausfahrt-Signale
- Robuste Felder: Betrag haeufig, Dauer/Ein-/Ausfahrt nur bei klarer Formatierung
- Teilweise / unsicher: Ort und Dauertexte je nach Layout
- Manuell zu bestaetigen: Parkhinweise insgesamt

### `toll`

- Erkennung: Maut-/Toll-/Station-/Autobahn-Signale
- Robuste Felder: Betrag haeufig, Station gelegentlich, Strecken-/Klasseninfos eher vorsichtig
- Teilweise / unsicher: Route, Fahrzeugklasse
- Manuell zu bestaetigen: alle Mauthinweise

## Phase D - Sicherheits- und Qualitaetspruefung

### Bestaetigte Schutzregeln

- Keine stille OCR-Ueberschreibung manueller Eingaben im Formular
- Originalbild bleibt unveraendert gespeichert
- OCR nutzt nur eine getrennte Arbeitskopie
- Kartenendziffern werden auf 2 bis 4 Ziffern begrenzt
- Vollstaendige Kartennummern werden nicht persistiert
- Fallbacks bei fehlender Kamera, fehlender Erkennung und schwacher OCR sind vorhanden
- Belegtyp faellt bei Unsicherheit auf `general` zurueck

### Performance- und UX-Bewertung

- Live-Analyse im Kamerafeed ist gedrosselt (`ANALYZE_INTERVAL_MS = 320`) und damit bewusst nicht auf maximale Frequenz gestellt
- Auto-Capture ist konservativ genug, um hektische Fehl-Ausloesungen zu vermeiden
- Mobile CPU-/Battery-Last ist aus dem Code ableitbar begrenzt, aber fuer schwache Geraete weiterhin ein beobachtungswuerdiger Punkt

## Phase E - Dokumentationspruefung

### Status

- README: aktuell und passend
- `docs/smart-capture.md`: aktuell und passend
- `docs/testing-checklist.md`: passend erweitert
- `docs/open-items.md`: aktuell
- `docs/mvp-abnahme.md`: direkt korrigiert

## Findings

### SC-001
- Titel: Echte Perspektivkorrektur fehlt weiterhin
- Bereich: Vorverarbeitung
- Schweregrad: mittel
- Status: offen
- Beschreibung: Die Arbeitskopie unterstuetzt Crop, Rotation und Kontrastverbesserung, aber keine echte Vierpunkt-Entzerrung.
- Nachweis: `src/lib/receipt-image-processing.ts`
- Auswirkung: Schraeg fotografierte Belege koennen weiterhin suboptimale OCR-Ergebnisse liefern.
- Empfehlung: In der naechsten Phase eine robuste perspektivische Entzerrung ergaenzen.
- Blockiert internen Praxistest: nein
- Blockiert Staging: nein

### SC-002
- Titel: Typ-spezifische Zusatzhinweise sind nur teilweise manuell bestaetigbar
- Bereich: Review-UX
- Schweregrad: mittel
- Status: offen
- Beschreibung: Unterkunfts-, Park- und Mauthinweise werden angezeigt und mit Feldstatus versehen, haben aber keine dedizierte manuelle Eingabe-/Bestaetigungsstrecke als finale Datenfelder.
- Nachweis: `src/components/receipts/smart-capture-suggestions.tsx`, `src/components/receipts/receipt-form.tsx`
- Auswirkung: Der Nutzer kann Hinweise lesen, aber nicht fuer alle Zusatzdaten eine explizite fachliche Uebernahme dokumentieren.
- Empfehlung: Kleine, gezielte Bestatigungs-/Korrektur-UX fuer typ-spezifische Zusatzdaten nachziehen.
- Blockiert internen Praxistest: nein
- Blockiert Staging: nein

### SC-003
- Titel: Spezialparser bleiben bewusst heuristisch
- Bereich: OCR-Feldzuordnung / Typen
- Schweregrad: niedrig
- Status: bewusst offen
- Beschreibung: `lodging`, `parking` und `toll` arbeiten mit klaren Keyword- und Musterheuristiken, nicht mit dom?nenspezifischer Tiefenlogik.
- Nachweis: `src/lib/ocr.ts`
- Auswirkung: Uneinheitliche oder internationale Sonderlayouts koennen nur teilweise erkannt werden.
- Empfehlung: Nur anhand realer Belegbeispiele gezielt nachschaerfen, keine generische Regel-Engine bauen.
- Blockiert internen Praxistest: nein
- Blockiert Staging: nein

### SC-004
- Titel: Smart-Capture-Doku war teilweise veraltet
- Bereich: Dokumentation
- Schweregrad: niedrig
- Status: direkt behoben
- Beschreibung: `docs/mvp-abnahme.md` widersprach dem aktuellen PDF-OCR-Stand.
- Nachweis: Dokumentationspruefung
- Auswirkung: Falsche Freigabe- oder Betriebsannahmen moeglich.
- Empfehlung: Doku bei jedem Smart-Capture-Ausbau zusammen mit dem Code nachziehen.
- Blockiert internen Praxistest: nein
- Blockiert Staging: nein

## Reifegradbewertung

- Entwicklungsfaehig: ja
- Intern testfaehig: ja
- Staging-faehig: ja
- Praxistauglich fuer echten internen Einsatz: ja

### Begruendung

Smart Capture ist funktional geschlossen genug fuer echte interne Erprobung: Kamera, Upload, OCR, Typvorschlaege, Review, Persistenz und Detailansicht greifen zusammen und verschlechtern Build, Versand, Druck oder Archiv nicht. Die verbleibenden Luecken liegen in der Verfeinerung, nicht in der Grundfunktion.

## Empfohlene naechste 5 Massnahmen

1. Dedizierte manuelle Bestaetigung/Korrektur fuer typ-spezifische Zusatzhinweise einfuehren
2. Perspektivkorrektur ueber Rotation/Crop hinaus robust erweitern
3. Parser nur anhand echter Unterkunft-/Park-/Mautbelege gezielt nachschaerfen
4. Mehr Nutzerhilfe fuer unsichere OCR-Hinweise im mobilen Review nachziehen
5. Smart-Capture-Testfaelle mit echten internen Belegbeispielen systematisch dokumentieren
