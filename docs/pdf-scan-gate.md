# BelegBox - Scan-PDF Staging Gate

Stand: 2026-04-03
Scope: Freigabenachweis nur fuer den bestehenden `pdf-scan`-Fallback ohne neue Features oder Parserwelten

## Ziel

Dieses Gate beantwortet nur eine Frage: Funktioniert der vorhandene Scan-PDF-Fallback mit echten Praxisdateien belastbar genug fuer Staging?

Nicht Teil dieses Gates:

- neue OCR-Features
- neue PDF-Parser-Architektur
- Ausbau der Positionslogik ueber den vorhandenen Stand hinaus
- Vollautomatik ohne Nutzerpruefung

## Aktueller technischer Stand

Der bestehende Scan-PDF-Pfad in `src/lib/ocr.ts` arbeitet so:

1. `pdf-parse.getText()` prueft, ob Direkttext vorhanden ist
2. falls kein brauchbarer Text vorliegt, rendert `pdf-parse.getScreenshot()` Seitenbilder
3. die ersten 3 Seiten laufen durch denselben OCR-Bildpfad wie JPG/PNG
4. bei verwertbarem OCR-Text wird `sourceType = pdf-scan`
5. bei leerem OCR-Ergebnis wird `sourceType = pdf-empty` und der manuelle Flow bleibt offen

Der Pfad ist im Code vorhanden. Der Audit vom 03.04.2026 hat aber gezeigt, dass er mit synthetischen bildbasierten PDFs noch nicht belastbar genug nachgewiesen ist.

## Realistisch aktuell unterstuetzte Scan-PDF-Typen

Mit dem vorhandenen Pfad sind derzeit nur diese Faelle realistisch fuer eine Freigabe denkbar:

- 1 bis 3 Seiten
- gute bis mittlere Scanqualitaet
- gerade ausgerichtete Seiten
- deutlicher Schwarz-auf-Weiss- oder Dunkel-auf-Hell-Kontrast
- uebliche A4-Rechnungen oder Kassenbelege ohne starke Hintergrundmuster
- ausreichend grosse Textdarstellung

Aktuell nicht belastbar zugesagt werden sollten:

- sehr blasse oder verrauschte Scans
- schiefe oder perspektivisch verzerrte Seiten
- Mobilfotos, die nur als PDF verpackt wurden und schlechte OCR-Bildqualitaet haben
- mehr als 3 Seiten mit relevanten Rechnungsdaten
- sehr kleine Schrift, Matrix- oder Nadel-Drucke
- stark mehrsprachige oder ungewoehnliche Layouts
- komplexe Tabellenpositionen in schwacher Scanqualitaet

## Scan-PDF-Testmatrix

Jeder Testfall ist mit einer echten Praxisdatei zu fahren. Synthetische PDFs reichen fuer die Freigabe nicht aus.

| ID | Typ | Beispiel | Erwartung Mindestniveau | Freigaberelevant |
| --- | --- | --- | --- | --- |
| SCAN-001 | 1-seitige Standardrechnung | sauberer Bueroscanner, schwarz/weiss | `sourceType = pdf-scan`, Rohtext vorhanden, Lieferant/Datum/Betrag mindestens teilweise erkannt | ja |
| SCAN-002 | 2-3-seitige Standardrechnung | erste Seite mit Kopf und Summen, Folgeseiten mit Details | erste 3 Seiten werden analysiert, Hinweistext erscheint, Rohtext aus den analysierten Seiten vorhanden | ja |
| SCAN-003 | Kassenbeleg als PDF-Scan | hoher Kontrast, wenige Zeilen | `pdf-scan` oder nachvollziehbarer Fallback; bei Erfolg mindestens Rohtext plus Betrag/Waehrung | ja |
| SCAN-004 | Standardrechnung mit Summenblock | Netto, Steuer, Brutto sichtbar | bei Erfolg mindestens Brutto robust, Netto/Steuer wenn plausibel als Vorschlag | ja |
| SCAN-005 | Standardrechnung mit Rechnungsnummer | klar beschriftete Rechnungsnummer | Rechnungsnummer nur wenn plausibel, sonst unsicher oder leer | ja |
| SCAN-006 | Schwacher Graustufenscan | leicht verrauscht, aber lesbar | manueller Flow bleibt nutzbar; kein Absturz; Fehlhinweis nachvollziehbar | ja |
| SCAN-007 | Schiefer/unscharfer Scan | echte Problemdatei | kein Crash, klare Warnung oder `pdf-empty`, manuelle Erfassung bleibt moeglich | ja |
| SCAN-008 | Mehrseitige Rechnung >3 Seiten | 4+ Seiten | Hinweis auf Begrenzung der ersten 3 Seiten, keine falsche Vollstaendigkeitsannahme | ja |
| SCAN-009 | Rechnung mit Positionszeilen | typische Tabelle, sauberer Scan | wenn OCR reicht: konservative Positionsvorschlaege; kein aggressives Falschparsing | optional |
| SCAN-010 | Problematisches/fast leeres Scan-PDF | defekt, leer, unleserlich | `pdf-empty` oder klare Fehlermeldung ohne Datenleck | ja |

## Freigabekriterien fuer Staging

### Muss-Kriterien

1. Bei `SCAN-001`, `SCAN-003`, `SCAN-004` liefert das System mit echten Praxisdateien verwertbaren Rohtext.
2. Bei mindestens 4 von 5 echten Kernfaellen `SCAN-001` bis `SCAN-005` wird `sourceType = pdf-scan` statt `pdf-empty` erreicht.
3. Bei erfolgreichen `pdf-scan`-Faellen ist mindestens einer der Kernwerte Lieferant, Datum, Rechnungsnummer oder Betrag nachvollziehbar vorgeschlagen.
4. Bei Rechnungen mit klarem Summenblock wird der Bruttobetrag nicht systematisch verfehlt.
5. Problemdateien (`SCAN-006`, `SCAN-007`, `SCAN-010`) duerfen nicht abstuerzen, keine irrefuehrende Erfolgsmeldung zeigen und muessen den manuellen Flow offen lassen.
6. Bei mehrseitigen Scans >3 Seiten erscheint der Begrenzungshinweis nachvollziehbar.
7. Es werden keine manuellen Kernfeldeingaben still ueberschrieben.
8. Logging und UI-Fehlertexte enthalten keine sensiblen OCR-Rohdaten.

### Soll-Kriterien

1. Netto, Steuer und Brutto werden bei klaren Summenzeilen zumindest teilweise vorgeschlagen.
2. Rechnungsnummern mit typischen Labels werden haeufig erkannt, aber unklare Faelle bleiben unsicher.
3. Bei klaren OCR-Zeilen koennen konservative Positionsvorschlaege erscheinen.

### Nicht-Freigabe

Keine Staging-Freigabe fuer Scan-PDFs, wenn einer dieser Punkte eintritt:

- Kernfaelle `SCAN-001` bis `SCAN-005` fallen mehrheitlich auf `pdf-empty`
- Rohtext fehlt regelmaessig trotz gut lesbarer Echtdateien
- Summen werden regelmaessig falsch statt nur vorsichtig/leer vorgeschlagen
- der Fallback blockiert den manuellen Flow oder erzeugt irrefuehrende Erfolgsanzeigen
- Problemdateien fuehren zu Crashs oder nicht nachvollziehbaren Fehlermeldungen

## Testdurchfuehrung

Pro Datei dokumentieren:

- Testfall-ID
- Dateityp und Herkunft der Praxisdatei
- Seitenzahl
- Scanqualitaet subjektiv: gut / mittel / schwach
- Ergebnis `sourceType`
- Rohtext vorhanden: ja / nein
- Kernfelder erkannt: Lieferant, Datum, Rechnungsnummer, Brutto, Waehrung
- Netto/Steuer vorhanden: ja / nein / unsicher
- Positionsvorschlaege vorhanden: ja / nein / partial
- UI-Hinweis korrekt: ja / nein
- manueller Flow intakt: ja / nein
- Gate-Urteil pro Datei: bestanden / grenzwertig / nicht bestanden

## Derzeitiger Gate-Status

Stand 2026-04-03:

- Text-PDFs sind ausserhalb dieses Gates bereits brauchbar verifiziert.
- Fuer Scan-PDFs ist der Codepfad vorhanden, aber die Staging-Freigabe ist noch offen.
- Der vorhandene Audit-Nachweis reicht noch nicht aus, um Scan-PDF-Unterstuetzung belastbar freizugeben.

## Naechster Schritt

Dieses Gate ist erst abgeschlossen, wenn die Testmatrix mit echten Scan-PDFs aus der Praxis durchlaufen und in `docs/pdf-analysis-audit.md` nachgetragen wurde.
