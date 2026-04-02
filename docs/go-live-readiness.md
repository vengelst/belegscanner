# BelegBox - Go-Live-Readiness

Stand: 2026-04-02
Status: aktuelle Freigabezusammenfassung

## Aktuelle Einordnung

- Entwicklungsfaehig: ja
- Intern testfaehig: ja
- Staging-faehig: ja
- Go-Live-faehig: noch nicht belastbar freigegeben

## Warum Staging-faehig

- priorisierte Audit-Punkte 1 bis 10 sind umgesetzt
- `npm run typecheck`, `npm run lint`, `npm run build` und `npx prisma validate` laufen
- Seed-Pfad ist zwischen Basisdaten und Demo-Daten getrennt
- Build ist nicht mehr still an produktive DB-Zugriffe in der Seitengenerierung gekoppelt
- Kernpfade fuer Auth, Erfassung, Review, Versand, Export und Reporting sind konsistent dokumentiert

## Was vor Go-Live noch als Nachweis fehlt

### 1. Echter Staging-End-to-End-Lauf
Ohne einen dokumentierten Staging-Durchlauf mit finaler PostgreSQL-, SMTP- und DATEV-Konfiguration bleibt Restunsicherheit fuer den produktiven Betrieb.

Verweis: [staging-test-run.md](staging-test-run.md)

### 2. Backup-/Restore-Nachweis
Backup und Restore sind dokumentiert, aber noch nicht praktisch verifiziert. Vor Go-Live braucht es mindestens einen erfolgreichen Probelauf.

Verweis: [backup-restore-test.md](backup-restore-test.md)

### 3. Betreiberfreigaben
Vor Go-Live muessen folgende Punkte organisatorisch oder betrieblich bestaetigt sein:
- produktive SMTP-Zugangsdaten freigegeben
- finale DATEV-Zieladresse bestaetigt
- HTTPS und Domain final eingerichtet
- Backup-Verantwortung und Restore-Verantwortung geklaert
- Monitoring und Log-Sichtung organisiert

## Go-Live-Blocker aus aktueller Sicht

### B-GL-001
- Titel: Kein dokumentierter Staging-E2E-Nachweis mit finaler Infrastruktur
- Schweregrad: hoch
- Blockiert Go-Live: ja
- Empfehlung: Staging-Testlauf vollstaendig durchfuehren und protokollieren

### B-GL-002
- Titel: Kein verprobter Backup-/Restore-Prozess
- Schweregrad: hoch
- Blockiert Go-Live: ja
- Empfehlung: Backup-/Restore-Test durchfuehren und dokumentieren

## Nicht-blockierende, aber bekannte Grenzen

- Batch-Versand ist nicht vorhanden
- Kein Zustelltracking hinter SMTP hinaus
- Wechselkurse werden manuell gepflegt

## Empfohlene Freigabelogik

### Freigabe fuer Staging
Freigeben, wenn:
- aktueller Build-Stand deployt ist
- Basis-Seed ohne Demo-Daten geladen ist
- Staging-Parameter gesetzt sind
- Kernpfade im Staging-Testlauf bestanden werden

### Freigabe fuer Go-Live
Erst freigeben, wenn:
- Staging-Testlauf dokumentiert bestanden ist
- Backup-/Restore-Test dokumentiert bestanden ist
- `docs/go-live-checklist.md` fachlich und betrieblich abgehakt ist
- offene Betreiberpunkte schriftlich geklaert sind

## Zugehoerige Dokumente

- [go-live-checklist.md](go-live-checklist.md)
- [staging-test-run.md](staging-test-run.md)
- [backup-restore-test.md](backup-restore-test.md)
- [deployment.md](deployment.md)
- [operating-guide.md](operating-guide.md)
- [final-audit.md](final-audit.md)
