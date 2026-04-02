# BelegBox - Finaler Gesamt-Check

Stand: 2026-04-02

## Pruefumfang

Geprueft wurden Struktur, Datenmodell, Auth, Sicherheitsbasis, Stammdaten und Seeds, Belegerfassung, OCR, Bewirtung, Review- und Versandlogik, Suche/Filter/Export, Reporting, Druck/PDF, Build-Verhalten sowie README- und Betriebsdokumente.

## Verifikationsbasis

- Codepruefung der kritischen Server- und UI-Pfade
- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `npx prisma validate`

## Ist-Zustand

### Vorhandene Kernfunktionen
- Login mit E-Mail/Passwort
- PIN-Login
- Rollenmodell `ADMIN` / `USER`
- Benutzerverwaltung
- Stammdatenverwaltung fuer Laender, Kfz, Zwecke, Kategorien und Versandstatus-Referenz
- Belegaufnahme mit Originaldatei, OCR und Nachbearbeitung
- Bewirtungslogik mit Pflichtfeldern
- Review-Workflow und Versandstatuslogik
- DATEV-/SMTP-Versand mit Retry und SendLogs
- Belegliste mit Suche, Filtern und CSV-Export
- Detailansicht, Druckansicht und PDF-Download
- Reporting mit EUR-Summen und Originalsummen je Waehrung

### Vollstaendig wirkende Bereiche
- Prisma-Datenmodell und Relationen
- Rollen- und Rechtepruefung in API und Admin-Pfaden
- Passwort-/PIN-Hashing und SMTP-Verschluesselung
- Review- und Versandstatus-Grundlogik
- Build-/Renderingstrategie fuer reproduzierbare Builds
- Seed-Trennung zwischen Basisdaten und optionalen Demo-Daten

### Teilweise oder bewusst begrenzt
- OCR fuer Bilder, Text-PDFs und begrenzt fuer Scan-PDFs
- Einzelversand ohne Batch-/Sammelversand
- Kein Zustelltracking hinter SMTP hinaus
- Keine automatische Wechselkursversorgung
- Betriebsprozesse wie Backup/Restore und Staging-UAT sind dokumentiert, aber nicht technisch automatisiert

### Doppelstrukturen / Altlasten
- Keine neuen Parallelimplementierungen in der App-Struktur gefunden.
- Aeltere Audit-/Release-Dokumente im `docs/`-Ordner spiegeln teils fruehere Zwischenstaende wider und sollten nicht als aktuelle Freigabequelle verwendet werden.

## Top-10-Status

1. Filter- und Exportvertrag fuer `reviewStatus`: erledigt
2. Review-Workflow fuer `reopen`: erledigt
3. Standard-Seed von Demo-Daten getrennt: erledigt
4. E-Mail/Passwort-Brute-Force-Schutz: erledigt
5. Build-/Renderingstrategie abgesichert: erledigt
6. Pflichtlogik fuer Originaldatei: erledigt
7. Receipt-Update auf gemeinsames Zod-Schema: erledigt
8. OCR-Vorbelegung ohne stilles Ueberschreiben: erledigt
9. Reporting fuer gemischte Originalwaehrungen korrigiert: erledigt
10. README und Betriebsdokumente vervollstaendigt: erledigt

## Restpunkte

### R-001
- ID: R-001
- Titel: Betriebsprozesse fuer Backup/Restore sind nicht verprobt
- Bereich: Betrieb / Go-Live
- Schweregrad: hoch
- Status: offen
- Beschreibung: Backup- und Restore-Pfade sind dokumentiert, aber nicht im Projekt technisch abgesichert oder nachweislich geprobt.
- Nachweis: `docs/open-items.md`, `docs/go-live-checklist.md`, `docs/operating-guide.md`
- Auswirkung: Erhoehtes Betriebsrisiko bei echtem Einsatz.
- Empfehlung: Vor Go-Live einen echten Restore-Test fahren.
- Blockiert Staging: nein
- Blockiert Go-Live: ja

### R-002
- ID: R-002
- Titel: Kein echter Staging-Durchlauf mit finaler Infrastruktur nachgewiesen
- Bereich: Deployment / Freigabe
- Schweregrad: hoch
- Status: offen
- Beschreibung: Build und Doku sind plausibel, aber ein realer Staging-Durchlauf mit finaler Datenbank-, SMTP- und DATEV-Konfiguration ist nicht nachgewiesen.
- Nachweis: `docs/mvp-abnahme.md`, `docs/go-live-checklist.md`
- Auswirkung: Restunsicherheit im produktionsnahen Verhalten.
- Empfehlung: Staging mit echten Betriebsparametern durchtesten und abzeichnen.
- Blockiert Staging: nein
- Blockiert Go-Live: ja

### R-003
- ID: R-003
- Titel: Historische Audit-/Release-Dokumente koennen Freigabeaussagen verwischen
- Bereich: Dokumentation
- Schweregrad: niedrig
- Status: offen
- Beschreibung: Im `docs/`-Ordner liegen aeltere Audit-, Risiko- und Release-Dokumente mit frueheren Bewertungen.
- Nachweis: `docs/app-audit.md`, `docs/app-risk-assessment.md`, `docs/release-candidate.md`
- Auswirkung: Moegliche Verwirrung, wenn nicht klar zwischen Historie und aktuellem Stand unterschieden wird.
- Empfehlung: Bei Bedarf spaeter historisch markieren oder in einen Archivbereich verschieben.
- Blockiert Staging: nein
- Blockiert Go-Live: nein

## Kleine direkte Korrekturen im finalen Check

### FZ-001
- Problem: In der Abnahmedoku stand fuer den Produktivpfad noch `prisma migrate dev` statt `prisma migrate deploy`.
- Aenderung: Produktionsvoraussetzung in `docs/mvp-abnahme.md` korrigiert.
- Betroffene Dateien: `docs/mvp-abnahme.md`
- Warum risikoarm: reine Dokumentationskorrektur ohne Codeeingriff.

## Gesamtbewertung

### Staging
Kein technischer Staging-Blocker aus den priorisierten Audit-Punkten mehr vorhanden. Der Build ist stabil, die Doku ist belastbar genug fuer einen kontrollierten Staging-Durchlauf, und die zentralen Fachpfade sind konsistent.

### Go-Live
Fuer Go-Live bleibt der Stand noch nicht belastbar freigegeben. Nicht wegen eines akuten Code-Blockers, sondern wegen fehlender betrieblicher Nachweise: insbesondere Backup/Restore und ein echter Staging-Durchlauf mit finaler Infrastruktur.

## Reifegradentscheidung

- Entwicklungsfaehig: ja
- Intern testfaehig: ja
- Staging-faehig: ja
- Go-live-faehig: noch nicht belastbar freigegeben

## Naechste 5 Massnahmen

1. Staging mit finaler DB-, SMTP- und DATEV-Konfiguration durchtesten und dokumentiert abnehmen.
2. Backup- und Restore-Prozess praktisch verproben.
3. Historische Freigabe-/Audit-Dokumente als Altstand markieren oder klar referenzieren.
4. Nicht kritische Wartbarkeits- und Komfortpunkte aus `docs/open-items.md` gesammelt priorisieren.
5. Scan-PDFs mit mehr als drei Seiten gezielt im Staging gegen echte Belegmuster pruefen.
