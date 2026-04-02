# BelegBox - PDF-Analyse Phase 1-3

Stand: 2026-04-03

## Ziel von Phase 1-3

PDF-Belege und PDF-Rechnungen laufen im bestehenden Receipt- und OCR-Flow mit. Es gibt keine zweite PDF-Erfassungsschiene.

Phase 1 deckt bewusst nur den Grundpfad ab:

- PDF-Upload im bestehenden Belegformular
- Unterscheidung zwischen textbasiertem PDF, Scan-PDF und problematischem/leeren PDF
- Direkte Text-Extraktion fuer textbasierte PDFs
- OCR-Fallback fuer Scan-PDFs ueber Seitenbilder, derzeit aber nur eingeschraenkt belastbar verifiziert
- Grundvorschlaege fuer Lieferant, Datum, Betrag, Waehrung, Rechnungsnummer und OCR-Rohtext
- Phase 2: vertiefte Rechnungs-Kernfelder fuer Rechnungsdatum, Leistungsdatum, Netto, Steuer und Brutto mit Confidence-/Review-Status
- Phase 3: Positionsvorschlaege fuer typische Rechnungszeilen, bevorzugt bei textbasierten PDFs
- Manuelle Nachbearbeitung bleibt immer moeglich

Nicht Teil von Phase 1:

- vollstaendige Rechnungspositionslogik
- vollstaendige Rechnungspositionslogik oder ein Steuer-Expertensystem
- komplexe Lieferantenklassifikation
- zweite Review- oder PDF-Architektur

## Integrationspfad

Der PDF-Pfad nutzt denselben Ablauf wie Bilddateien:

1. Upload im bestehenden Formular `src/components/receipts/receipt-form.tsx`
2. OCR-Aufruf an `POST /api/ocr/analyze`
3. Analyse in `src/lib/ocr.ts`
4. Vorschlaege im Formular und Speicherung als `ocrRawText` plus `ocrStructuredData`
5. Anzeige in Detailansicht, Versand- und Druckflow bleiben unveraendert nutzbar

Das Original-PDF wird weiterhin unveraendert als Originaldatei gespeichert.

## PDF-Typ-Erkennung

Phase 1 nutzt eine pragmatische Erkennung direkt im bestehenden OCR-Service:

- `pdf-text`: Das PDF enthaelt direkt verwertbaren Text
- `pdf-scan`: Das PDF liefert keinen brauchbaren Text, aber Seitenbilder koennen per OCR analysiert werden. Dieser Pfad ist im Code vorhanden, im Audit aber nur eingeschraenkt praxistauglich verifiziert.
- `pdf-empty`: Weder Text-Extraktion noch OCR-Fallback liefern verwertbaren Inhalt

Die Klassifikation ist bewusst praktisch statt akademisch. Ziel ist ein belastbarer Receipt-Flow.

## Textbasierte PDFs

Textbasierte PDFs werden ueber `pdf-parse` direkt gelesen.

Danach gilt derselbe nachgelagerte Parser wie fuer Bild-OCR:

- Rohtext wird normalisiert
- Grundfelder werden heuristisch abgeleitet
- Vorschlaege werden im Formular angezeigt
- Beim Speichern werden `ocrRawText` und `ocrStructuredData` am Beleg mitgefuehrt

## Scan-PDFs

Wenn ein PDF keinen brauchbaren Direkttext liefert, wird auf Seitenbild-OCR umgeschaltet.

Phase 1 Verhalten:

- Seiten werden als Bilder gerendert
- aktuell werden die ersten 3 Seiten analysiert
- die Bilder laufen durch denselben OCR-/Parser-Pfad wie Bilddateien
- bei Erfolg ist `sourceType = pdf-scan`
- bei eingeschraenkter Aussagekraft wird ein Hinweis fuer den Nutzer angezeigt

Das ist bewusst ein sauberer Fallback im bestehenden System, keine neue Parallelarchitektur.

## Strukturierte Grundfelder in Phase 1-3

Soweit robust erkennbar, werden vorgeschlagen:

- Lieferant
- Datum
- Rechnungsdatum
- Faelligkeitsdatum
- Leistungsdatum
- Betrag / Bruttobetrag
- Nettobetrag
- Steuerbetrag
- Waehrung
- Rechnungsnummer
- OCR-Rohtext

Weitere Felder wie Zahlungsart, Kartenendziffern, Land und bestehende Smart-Capture-Hinweise koennen weiterhin ebenfalls auftauchen, wenn sie schon im bestehenden OCR-Modell erkannt werden.


## Rechnungs-Kernfelder in Phase 2

Phase 2 vertieft die bestehende PDF-Analyse im selben OCR-/Receipt-Flow:

- Lieferant wird im Kopfbereich robuster gescored und gegen Empfaenger-/Kundenbloecke abgegrenzt
- Rechnungsnummer wird keywordbasiert, aber toleranter gegen OCR-Zeichenfehler und Trennzeichen erkannt
- Rechnungsdatum, Faelligkeitsdatum und Leistungsdatum werden, soweit plausibel, getrennt vorgeschlagen
- Netto, Steuer und Brutto werden aus typischen Summenzeilen abgeleitet; mehrere Steuerzeilen koennen pragmatisch aufsummiert werden
- `date` und `amount` bleiben die primaeren Vorschlagsfelder fuer den bestehenden Receipt-Kern
- vertiefte Rechnungsfelder werden zunaechst als `ocrStructuredData` plus Feldstatus mitgefuehrt, nicht als unkontrollierte Kernwert-Ueberschreibung

## Confidence und Review

Fuer Rechnungs-Kernfelder gelten weiterhin die bestehenden Feldstatus:

- `detected_confident`: plausibler, robuster Treffer
- `detected_uncertain`: Treffer vorhanden, aber pruefbeduerftig
- `not_detected`: kein belastbarer Vorschlag
- `user_confirmed`: beim Speichern bestaetigt uebernommen
- `user_overridden`: manuelle Eingabe hat Vorrang

Phase 2 fuehrt keine zweite Review-Welt ein. Die PDF-Rechnungsfelder nutzen dasselbe `fieldConfidence`- und `fieldReviewStates`-Modell wie bestehende OCR-Vorschlaege.

Faelligkeitsdatum wird nur bei klaren Keywords wie `faellig`, `zahlbar bis` oder `due date` vorgeschlagen. Unklare Mehrfachdaten bleiben bewusst leer oder unsicher.


## Rechnungspositionen in Phase 3

Phase 3 erweitert denselben OCR-/Receipt-Flow um Positionsvorschlaege. Es gibt keine zweite Parser- oder Review-Welt.

Unterstuetzte Positionsdaten pro Zeile, wenn plausibel:

- laufende Nummer optional
- Bezeichnung
- Menge optional
- Einheit optional
- Einzelpreis optional
- Gesamtpreis optional
- Steuerhinweis optional
- Zeilenstatus `confident`, `uncertain` oder `partial`

Textbasierte PDFs werden bevorzugt:

- Tabellenkopf oder typische Spaltenzeilen werden als Startsignal genutzt
- Summenzeilen werden ausgefiltert
- mehrzeilige Beschreibungen werden pragmatisch zusammengezogen
- Positionen landen als `special.invoice.lineItems` in `ocrStructuredData`

Scan-/OCR-Faelle bleiben bewusst konservativ:

- primaer Beschreibung plus Zeilenbetrag
- Menge und Einzelpreis nur bei klaren OCR-Zeilen
- bei schwachen OCR-Daten lieber keine oder nur partielle Positionen
- Audit-Stand 2026-04-03: Der Seitenbild-Fallback ist implementiert, aber fuer synthetische Scan-PDFs noch nicht belastbar genug nachgewiesen

## Fehler- und Warnverhalten

Die PDF-Analyse blockiert den manuellen Flow nicht.

Verhalten in Phase 1:

- bei erfolgreicher Analyse: Vorschlaege und Rohtext werden angezeigt
- bei Scan-PDF-Fallback: Hinweistext erklaert, dass Seitenbild-OCR genutzt wurde
- bei leerem/problematischem PDF: nachvollziehbare Warnung, manuelle Erfassung bleibt moeglich
- Server-Logging protokolliert nur Metadaten und Fehlertypen, nicht den OCR-Rohtext

## Bewusste Grenzen von Phase 1

- keine vollstaendige Rechnungspositionsanalyse
- keine robuste Mehrseiten-Rechnungslogik jenseits des Grundpfads
- keine vollstaendige Positions- oder Mehrwertsteuer-Speziallogik
- keine universelle Tabellenengine fuer alle Rechnungslayouts
- Rechnungsnummer, Lieferant und Datums-/Betragsfelder bleiben heuristische Vorschlaege und muessen in Grenzfaellen geprueft werden
- Scan-PDFs aktuell auf die ersten 3 Seiten begrenzt
- Scan-PDF-Pfad ist im Code vorhanden, aber vor Staging fuer echte Praxisfaelle nochmals separat zu verifizieren

## Testfaelle fuer Phase 1

Manuell pruefen:

- textbasiertes PDF mit erkennbarem Direkttext
- Scan-PDF mit gut lesbarem Seitenbild
- PDF ohne brauchbaren Text
- PDF mit Lieferant, Datum, Betrag, Waehrung und Rechnungsnummer
- Detailansicht mit OCR-Rohtext und Smart-Capture-Vorschlaegen

Siehe auch `docs/testing-checklist.md`.
