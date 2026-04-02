# BelegBox - Gesamt-App-Audit

> Hinweis: ALTSTAND: Erstes Gesamt-Audit vor den priorisierten Abschlussfixes. Fuer den aktuellen Freigabestand stattdessen `docs/final-audit.md` und `docs/go-live-readiness.md` verwenden.


Stand: 2026-04-02
Audit-Typ: Bestandsaufnahme, Mangelanalyse, Risikoanalyse, Abnahmeeinschaetzung

## 1. Ueberblick ueber den Ist-Zustand

BelegBox ist als Anwendung funktional weit entwickelt. Vorhanden sind Auth mit Rollen und PIN-Login, Stammdatenverwaltung, Benutzerverwaltung, Receipt-Erfassung mit Upload und OCR, Review- und Versandworkflow, Druckansicht, PDF-Generierung, Reporting und CSV-Export.

Die App ist jedoch noch nicht go-live-faehig. Es bestehen relevante Luecken zwischen Dokumentation und Realitaet, einzelne fachliche Inkonsistenzen im Workflow sowie betriebliche Risiken fuer Staging und Deployment.

## 2. Bereits vorhandene und nutzbare Funktionen

- Login mit E-Mail/Passwort
- PIN-Login ueber E-Mail + PIN
- Rollen ADMIN/USER
- Benutzerverwaltung
- Stammdatenverwaltung fuer Laender, Kfz, Zwecke, Kategorien
- SMTP-Konfiguration und Testversand
- DATEV-Profile
- Beleganlage, Bearbeitung, Detailansicht
- Datei-Upload fuer JPG, PNG, PDF
- OCR fuer Bilder
- Bewirtungslogik
- Review-Workflow
- Einzelversand und Retry
- Versandlog und Kommentare
- Such- und Filterliste mit Pagination
- HTML-Druckansicht und PDF-Download
- Reporting und CSV-Export fuer Admin

## 3. Unvollstaendige oder nur vorbereitete Teile

- PDF-OCR ist nicht umgesetzt.
- Audit-Log ist im Datenmodell vorhanden, aber funktional nicht durchgaengig aktiv.
- DATEV-Versand mit generiertem PDF als Zusatzanhang fehlt.
- Build-/Deployment-Pfad ist noch nicht robust genug fuer saubere Freigaben.
- README als operativer Einstieg fehlt praktisch.

## 4. Doppelstrukturen / Altlasten / Inkonsistenzen

- Doku und Code widersprechen sich beim realen Freigabestatus.
- `open-items` und realer Funktionsumfang widersprechen sich bei Exporten.
- Page/UI, API und Export werten Filter nicht konsistent aus.
- Seed kombiniert Stammdaten, Demo-Zugaenge und Demo-Fachdaten in einem Pfad.

## 5. Fachliche Findings

Siehe [app-findings.md](/c:/coding/belegscanner/docs/app-findings.md). Besonders relevant:
- F-003 Filter-/Exportinkonsistenz
- F-004 fragliche Review-Reopen-Regel
- F-009 Beleganlage ohne Pflicht-Originaldatei
- F-012 fachlich missverstaendliche Reporting-KPI

## 6. Technische Findings

Besonders relevant:
- F-002 Build-/DB-Kopplung
- F-007 fehlende gemeinsame Update-Validierung
- F-011 vormals instabiles Typecheck-Skript, im Audit behoben
- F-014 fragile DOM-getriebene Admin-Edit-Logik

## 7. Sicherheitsfindings

Besonders relevant:
- F-001 Upload-Rechtefehler, im Audit behoben
- F-005 Demo-Zugaenge im Standard-Seed
- fehlender Brute-Force-Schutz fuer E-Mail/Passwort-Login

## 8. UX-/Bedienfindings

Besonders relevant:
- F-008 OCR kann Eingaben ueberschreiben
- F-009 unvollstaendige Erfassung ohne Originaldatei moeglich

## 9. Dokumentationsfindings

Besonders relevant:
- F-006 Abnahmestatus war zu positiv
- F-010 Versandumfang in Doku nicht durchgaengig sauber
- F-013 README als Einstieg unzureichend

## 10. Abnahmeeinschaetzung

### Welche Funktionen sind tatsaechlich vorhanden und nutzbar?
Die Kernfunktionen fuer Erfassung, Bearbeitung, Pruefung, Versand, Druck und Administration sind real implementiert und grundsaetzlich nutzbar.

### Welche Bereiche sind stabil?
- Datenmodell und Relationen
- Grundlegende Authentifizierung
- Stammdaten- und Benutzerverwaltung
- Detailansicht, Druckansicht und PDF-Generierung
- SMTP-Verschluesselung und Versandprotokollierung

### Welche Bereiche sind nur teilweise fertig?
- OCR fuer PDFs
- Audit-Logging
- Deployment-/Build-Haertung
- Workflow-Konsistenz in Filter/Export/Review

### Welche Probleme sind kritisch?
- Der Upload-Rechtefehler war kritisch und wurde direkt behoben.

### Welche Probleme blockieren Staging?
- F-002
- F-003
- F-005

### Welche Probleme blockieren Go-Live?
- Fehlender Brute-Force-Schutz fuer E-Mail/Passwort
- F-004
- F-005
- Zuverlaessige Betriebs-/Freigabedokumentation

### Welche Punkte sind Komfort-/Qualitaetsthemen?
- OCR-Feinschliff
- Reporting-KPI-Schaerfung
- README-Ausbau
- Wartbarkeitsverbesserungen in Admin-Komponenten

### Gesamturteil
- Entwicklungsfaehig: ja
- Intern testfaehig: ja
- Staging-faehig: noch nicht belastbar
- Go-live-faehig: nein

## 11. Verweise

- Inventar: [app-inventory.md](/c:/coding/belegscanner/docs/app-inventory.md)
- Findings: [app-findings.md](/c:/coding/belegscanner/docs/app-findings.md)
- Risikoanalyse: [app-risk-assessment.md](/c:/coding/belegscanner/docs/app-risk-assessment.md)
- Prioritaeten: [app-priorities.md](/c:/coding/belegscanner/docs/app-priorities.md)
