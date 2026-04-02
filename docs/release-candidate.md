# BelegBox - Release Candidate

> Hinweis: ALTSTAND: Fruehere Release-Candidate-Einschaetzung. Nicht als aktuelle Freigabegrundlage verwenden.


Stand: 2026-04-02
Version: 1.0.0 RC-1

---

## Freigabestatus: Go-Live-bereit

Alle fachlichen Flows sind implementiert, getestet (UAT) und stabil. Alle kritischen und hohen Bugs sind behoben. Zwei UX-Verbesserungen (OCR-Formular, Betragsanzeige) sind nachgezogen. Der Stand ist bereit fuer Staging-Deployment und kontrollierten Produktiveinsatz.

### Voraussetzungen fuer Produktiveinsatz

| Voraussetzung | Status |
|---|---|
| Code vollstaendig und getestet | Ja |
| Alle UAT-Bugs behoben | Ja (7/7) |
| UX-Polish nach UAT | Ja (2/2) |
| Docker Compose vorhanden | Ja |
| Deployment-Doku vorhanden | Ja |
| Go-Live-Checkliste vorhanden | Ja |
| Betriebsleitfaden vorhanden | Ja |
| HTTPS konfiguriert | Offen (Betreiber) |
| Echte SMTP-Zugangsdaten | Offen (Betreiber) |
| Echte DATEV-Adresse | Offen (Betreiber) |
| Sichere Geheimnisse generiert | Offen (Betreiber) |

## Pakethistorie

| Paket | Inhalt | Status |
|---|---|---|
| 1 | Projektsetup, Prisma, Migration, Seed | Fertig |
| 2 | Auth, Session, Benutzerverwaltung | Fertig |
| 3 | Stammdaten, SMTP, DATEV-Profile | Fertig |
| 4 | Belegerfassung, Upload, OCR | Fertig |
| 5 | DATEV-Versand, Statusfluss, Logging | Fertig |
| 6 | Belegliste, Suche, Filter, Pagination | Fertig |
| 7 | DIN-A4-Druckansicht, PDF-Generierung | Fertig |
| 8 | Bewirtung finalisiert, Speichern & Senden | Fertig |
| 9 | Aufraeuumen, Konsistenz, Test-Checkliste | Fertig |
| 10 | Docker, Demo-Daten, Setup-Doku, Deployment | Fertig |
| 11 | UAT, Bug-Fixes, Praxistest | Fertig |
| 12 | Post-UAT-Fixes, UX-Polish, RC | Fertig |
| 13 | Release-Doku, Betriebsuebergabe, Go-Live | Fertig |

## Behobene Bugs (vollstaendig)

| ID | Schwere | Beschreibung | Status |
|---|---|---|---|
| BUG-001 | HOCH | sendAfterSave Race Condition | BEHOBEN |
| BUG-002 | HOCH | Decimal-to-Number Casting | BEHOBEN |
| BUG-003 | MITTEL | SMTP ohne Passwort bei Ersteinrichtung | BEHOBEN |
| BUG-004 | MITTEL | User PUT ambigue Erkennung | BEHOBEN |
| BUG-005 | MITTEL | ocrRawText nicht validiert | BEHOBEN |
| BUG-006 | MITTEL | Doppelte Datei-Uploads | BEHOBEN |
| BUG-007 | NIEDRIG | lastLog null-Fallback | BEHOBEN |
| UX-001 | MITTEL | OCR-Werte nicht in Formularfelder | BEHOBEN |
| UX-002 | NIEDRIG | Betragsfelder Punkt statt Komma | BEHOBEN |

## Bekannte Einschraenkungen (nicht RC-blockierend)

1. OCR nur fuer Bilder (JPG/PNG), nicht fuer PDFs
2. Wechselkurse muessen manuell eingegeben werden
3. Einzelversand (kein Batch)
4. AuditLog-Modell vorhanden, nicht aktiv befuellt
5. Kein E-Mail-Zustellungstracking

## Zugehoerige Dokumentation

| Dokument | Zweck |
|---|---|
| [setup.md](setup.md) | Lokales Setup und Entwicklung |
| [deployment.md](deployment.md) | Docker Compose und Bare-Metal Deployment |
| [go-live-checklist.md](go-live-checklist.md) | Pre-Production-Pruefung |
| [operating-guide.md](operating-guide.md) | Taeglicher Betrieb und Fehlerbehebung |
| [release-notes.md](release-notes.md) | Funktionen, Fixes, Einschraenkungen |
| [testing-checklist.md](testing-checklist.md) | Manuelle Testfaelle |
| [uat-testplan.md](uat-testplan.md) | UAT-Szenarien |
| [uat-results.md](uat-results.md) | UAT-Ergebnisse |
| [bug-log.md](bug-log.md) | Fehlerprotokoll |
| [open-items.md](open-items.md) | Bewusst offene Punkte |
