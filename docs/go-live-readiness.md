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

- PDF-OCR ist nicht umgesetzt
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


# BelegBox – Go-Live Readiness

**Stand:** YYYY-MM-DD  
**Geprüfter Commit / Tag:** `<commit-or-tag>`  
**Geprüfte Umgebung:** `staging`  
**Prüfer:** `<Name>`  

---

## 1. Ziel dieser Freigabe

Diese Freigabe bewertet, ob der aktuelle Stand von **BelegBox** nach technischem Audit, Dokumentationsprüfung, Staging-End-to-End-Test und Backup-/Restore-Nachweis für den produktiven Einsatz freigegeben werden kann.

---

## 2. Zusammenfassung

**Gesamtstatus:**  
- [ ] Nicht freigegeben  
- [ ] Unter Vorbehalt freigegeben  
- [ ] Go-Live freigegeben  

**Kurzbegründung:**  
_1–5 Sätze zur Entscheidung._

Beispiel:  
Der aktuelle Stand ist technisch stabil, die priorisierten Audit-Punkte sind abgearbeitet, der Staging-End-to-End-Test wurde erfolgreich durchgeführt und Backup/Restore wurde praktisch verprobt. Offene Restpunkte sind dokumentiert und blockieren den Produktiveinsatz nicht.

---

## 3. Nachweise

### 3.1 Technischer Audit-Stand
- [ ] Finaler Audit geprüft
- [ ] Top-10-Auditpunkte erledigt
- [ ] Keine kritischen offenen Code-Blocker
- Referenzen:
  - `docs/final-audit.md`
  - `docs/app-findings.md`
  - `docs/app-priorities.md`

### 3.2 Staging-End-to-End-Test
- [ ] durchgeführt
- [ ] bestanden
- [ ] mit Einschränkungen bestanden
- [ ] nicht bestanden

**Datum:** `YYYY-MM-DD`  
**Umgebung:** `<staging-url-or-environment>`  
**Testprotokoll:** `docs/staging-test-run.md`

**Ergebnis / Notizen:**  
- Login: `<ok/nicht ok>`
- PIN-Login: `<ok/nicht ok>`
- Stammdaten: `<ok/nicht ok>`
- Belegerfassung: `<ok/nicht ok>`
- OCR: `<ok/nicht ok>`
- Bewirtung: `<ok/nicht ok>`
- DATEV-/SMTP-Versand: `<ok/nicht ok>`
- Retry: `<ok/nicht ok>`
- Suche / Filter / Export: `<ok/nicht ok>`
- Druckansicht: `<ok/nicht ok>`

**Zusammenfassung:**  
_Kurze Bewertung des Staging-Durchlaufs._

### 3.3 Backup-/Restore-Test
- [ ] durchgeführt
- [ ] bestanden
- [ ] mit Einschränkungen bestanden
- [ ] nicht bestanden

**Datum:** `YYYY-MM-DD`  
**Testprotokoll:** `docs/backup-restore-test.md`

**Geprüft wurden:**  
- [ ] Datenbank-Backup
- [ ] Datenbank-Restore
- [ ] Storage-/Datei-Restore
- [ ] App läuft nach Restore korrekt
- [ ] Stichprobe auf wiederhergestellte Belege erfolgreich

**Zusammenfassung:**  
_Kurze Bewertung des Backup-/Restore-Tests._

---

## 4. Produktivvoraussetzungen

Bitte vor Go-Live bestätigen:

- [ ] Produktions-ENV vollständig gesetzt
- [ ] Datenbank erreichbar
- [ ] `prisma migrate deploy` erfolgreich ausgeführt
- [ ] Stammdaten vorhanden
- [ ] Admin-Benutzer vorhanden
- [ ] SMTP produktiv korrekt eingerichtet
- [ ] DATEV-Profil produktiv korrekt eingerichtet
- [ ] Storage erreichbar
- [ ] OCR konfiguriert oder bewusst als Fallback betrieben
- [ ] Testbeleg erfolgreich verarbeitet
- [ ] Logging / Fehlerprüfung ausreichend
- [ ] Zugriffsrechte / Adminschutz geprüft

---

## 5. Offene Restpunkte

### Nicht blockierend
- `<Restpunkt 1>`
- `<Restpunkt 2>`
- `<Restpunkt 3>`

### Blockierend
- `<falls vorhanden, sonst "keine">`

---

## 6. Risiken

### Bekannte Risiken
- `<Risiko 1>`
- `<Risiko 2>`

### Gegenmaßnahmen
- `<Maßnahme 1>`
- `<Maßnahme 2>`

---

## 7. Freigabeentscheidung

**Entscheidung:**  
- [ ] Kein Go-Live  
- [ ] Go-Live unter Vorbehalt  
- [ ] Go-Live freigegeben  

**Freigegeben ab:** `YYYY-MM-DD`  

**Begründung:**  
_Klare 3–8 Sätze zur Entscheidung._

Beispiel:  
BelegBox wird für den Produktiveinsatz freigegeben. Der technische Audit ist abgeschlossen, die priorisierten Mängel sind behoben, der Staging-Testlauf war erfolgreich und der Backup-/Restore-Prozess wurde praktisch nachgewiesen. Die verbliebenen offenen Punkte sind dokumentiert und gelten als nicht blockierend.

---

## 8. Empfohlene Maßnahmen nach Go-Live

1. `<z. B. PDF-OCR priorisieren>`
2. `<z. B. Komfortfunktionen weiter ausbauen>`
3. `<z. B. offene Wartbarkeitspunkte aus open-items.md abarbeiten>`
4. `<z. B. Monitoring/Fehleranalyse nach den ersten realen Belegen prüfen>`
5. `<z. B. historische Doku weiter bereinigen>`

---

## 9. Freigabevermerk

**Erstellt von:** `<Name>`  
**Geprüft von:** `<Name>`  
**Freigegeben von:** `<Name>`  

**Datum:** '2026/04/02`