# BelegBox - PDF-Analyse Audit

Stand: 2026-04-03
Scope: Gesamtcheck Phase 1 bis 3 der PDF-Rechnungsanalyse ohne neue Architektur oder Grossmodule

## Pruefumfang

Geprueft wurden:

- PDF-Upload im bestehenden Receipt-Flow
- PDF-Typ-Erkennung (`pdf-text`, `pdf-scan`, `pdf-empty`)
- Text-Extraktion und OCR-Fallback
- Trennung Original-PDF vs. Analysepfad
- Grundfeld- und Rechnungsfeld-Erkennung
- Positionslogik
- Confidence-/Review-Logik
- Formular-Merge, Persistenz, Detailansicht
- Auswirkungen auf Versand, Druck und Archiv
- Fehlerlogging, Doku und Teststand

## Verifikationsstand

### Vollstaendig bzw. belastbar verifiziert

- Gemeinsamer Receipt-Flow fuer PDF und Bilddateien
- Dateivalidierung fuer JPG, PNG, PDF bis 20 MB
- Textbasierte PDFs: Direktextraktion ueber `pdf-parse`
- Rohtext, Lieferant, Rechnungsnummer, Rechnungs-/Leistungsdatum, Netto/Steuer/Brutto fuer typische Text-PDFs
- Positionsvorschlaege fuer typische textbasierte Rechnungszeilen
- Review-/Confidence-Darstellung in Formular und Detailansicht
- Keine stille Ueberschreibung manueller Kernfelder `date`, `amount`, `currency`, `supplier`
- Originaldatei bleibt getrennt gespeichert; OCR arbeitet bei PDFs nicht auf der gespeicherten Datei

### Teilweise verifiziert

- OCR-Bildpfad fuer einfache Rechnungsbilder
- Konservative Positionsvorschlaege fuer OCR-Bildzeilen
- Logging und Warnmeldungen ohne Rohtext-Leak
- Scan-PDF-Pfad als implementierter Fallback im Code, aber noch ohne bestandenen Staging-Gate-Nachweis

### Nur eingeschraenkt oder nicht belastbar verifiziert

- Scan-PDF-Fallback ueber Seitenbilder: im Code vorhanden, aber im Audit mit synthetischen bildbasierten PDFs nicht praxistauglich nachgewiesen
- Scan-PDF-Positionslogik: nur auf OCR-Bildzeilen, nicht auf echtem `pdf-scan`-Ergebnis belastbar verifiziert
- Mehrseitige oder komplexe Positionsbereiche

## Scan-PDF Gate-Status

- Eigene Gate-Doku liegt jetzt in `docs/pdf-scan-gate.md` vor.
- Freigabekriterien fuer echte Praxisdateien sind definiert.
- Stand 2026-04-03: Gate offen, weil noch kein belastbarer Nachweis mit echten Scan-PDFs vorliegt.

## Findings

### PDF-001
- Titel: Scan-PDF-Fallback ist praktisch nicht belastbar nachgewiesen
- Bereich: OCR-Fallback / PDF-Typ-Erkennung
- Schweregrad: hoch
- Status: offen
- Beschreibung: Der Code fuer `pdf-scan` existiert, aber synthetische bildbasierte PDFs liefen im Audit trotz gerenderter Seitenbilder auf `pdf-empty`.
- Nachweis: `src/lib/ocr.ts:322-400`; Audit-Test am 03.04.2026 mit bildbasiertem PDF -> `sourceType: pdf-empty`; `pdf-parse.getScreenshot()` lieferte zwar eine PNG-Seite, OCR darauf blieb leer.
- Auswirkung: Text-PDFs funktionieren, echte Scan-PDFs sind aktuell nicht belastbar fuer Staging zugesagt.
- Empfehlung: Vor Staging echte Scan-PDFs mit typischen Lieferantenbelegen anhand von `docs/pdf-scan-gate.md` verifizieren und den Seitenbild-Fallback nur bei klaren Befunden gezielt nachschaerfen.
- Blockiert internen Praxistest: nein
- Blockiert Staging: ja, fuer Scan-PDF-Unterstuetzung

### PDF-002
- Titel: Dokumentation war optimistischer als der aktuell nachgewiesene Scan-PDF-Stand
- Bereich: Dokumentation / Abnahme
- Schweregrad: mittel
- Status: direkt korrigiert
- Beschreibung: Die Produktdoku beschrieb Scan-PDFs als vorhandenen Phase-1-3-Pfad, ohne die praktische Audit-Einschraenkung sichtbar zu machen.
- Nachweis: `docs/pdf-analysis.md`, `docs/open-items.md`, `docs/testing-checklist.md`, `docs/mvp-abnahme.md` wurden auf Audit-Stand aktualisiert; `docs/pdf-scan-gate.md` dokumentiert jetzt das eigene Freigabegate.
- Auswirkung: Vor der Korrektur haette das Team die PDF-Reife zu positiv lesen koennen.
- Empfehlung: Audit-Doku und Scan-Gate-Doku als Referenz fuer die naechste Freigabe verwenden.
- Blockiert internen Praxistest: nein
- Blockiert Staging: nein

### PDF-003
- Titel: Receipt wird vor Originaldatei gespeichert
- Bereich: Receipt-Flow / Archiv
- Schweregrad: mittel
- Status: offen
- Beschreibung: `POST /api/receipts` legt den Beleg an, erst danach folgt `POST /api/files/upload` mit der Originaldatei. Bei Upload-Fehlern bleibt ein Beleg ohne Originaldatei bestehen.
- Nachweis: `src/components/receipts/receipt-form.tsx:323-347`, `src/app/api/files/upload/route.ts:36-56`
- Auswirkung: Archiv- und Versandpfad koennen bei seltenen Fehlern inkonsistent werden.
- Empfehlung: Vor produktivem Einsatz einen atomareren Flow oder einen klaren Nachbearbeitungsmechanismus fuer fehlende Originaldateien vorsehen.
- Blockiert internen Praxistest: nein
- Blockiert Staging: nein

### PDF-004
- Titel: Positionslogik ist fuer Text-PDFs brauchbar, fuer freie Layouts aber bewusst begrenzt
- Bereich: Positionsanalyse
- Schweregrad: mittel
- Status: akzeptierte Einschraenkung
- Beschreibung: Typische textbasierte Zeilen mit Menge/Einzelpreis/Gesamtpreis werden erkannt, komplexe Tabellen oder mehrzeilige Blockstrukturen aber nicht universell.
- Nachweis: `src/lib/ocr.ts:1178-1330`; Audit-Test am 03.04.2026 mit textbasiertem Rechnungs-PDF -> zwei Positionen strukturiert erkannt.
- Auswirkung: Fuer typische interne Rechnungen brauchbar, fuer exotische Layouts nur Zusatzhilfe.
- Empfehlung: Erst nach realen Staging-Belegen entscheiden, ob Phase 4 hier weiter ausgebaut werden muss.
- Blockiert internen Praxistest: nein
- Blockiert Staging: nein

## Kleine direkte Korrekturen im Audit

1. Problem: Doku zu Scan-PDF-Reife war zu optimistisch und ohne explizites Freigabegate.
2. Aenderung: PDF-Doku, Open Items und Testing-Checklist auf Audit-Stand nachgezogen und ein eigenes Scan-PDF-Gatedokument angelegt.
3. Betroffene Dateien: `docs/pdf-scan-gate.md`, `docs/pdf-analysis-audit.md`, `docs/open-items.md`, `docs/testing-checklist.md`
4. Warum risikoarm: Nur textliche Korrektur und Freigabevorbereitung, keine Laufzeitlogik geaendert.

## Gesamtbewertung

- Textbasierte PDFs sind aktuell intern testfaehig und fuer einen kontrollierten Staging-Test plausibel.
- Scan-PDFs sind im Code vorbereitet, aber praktisch noch kein belastbar nachgewiesener Staging-Pfad.
- Rechnungs-Kernfelder sind fuer typische Text-PDFs gut, fuer OCR-/Scan-Faelle weiterhin heuristisch.
- Positionsanalyse ist fuer typische textbasierte Rechnungen brauchbar, fuer Scan-PDFs nur vorbereitend/konservativ.

## Empfehlung

1. Text-PDF-Pfad intern weiter testen und fuer Staging nutzen.
2. Scan-PDFs vor Staging mit echten Praxisdateien separat anhand von `docs/pdf-scan-gate.md` pruefen.
3. Fehlende Originaldatei nach gescheitertem Upload als bekannten Betriebsrestpunkt behandeln.
