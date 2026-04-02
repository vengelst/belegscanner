# BelegBox - Staging-Testlauf

Stand: 2026-04-02
Status: operative Checkliste fuer einen echten End-to-End-Durchlauf

## Ziel

Diese Anleitung dient dem ersten echten Staging-Durchlauf mit finaler PostgreSQL-, SMTP- und DATEV-Konfiguration. Ziel ist ein belastbarer Nachweis, dass die produktionsnahen Kernpfade unter realen Betriebsparametern funktionieren.

## Voraussetzungen

- Staging-URL steht fest und ist per HTTPS erreichbar
- Staging-Datenbank ist frisch oder bewusst vorbereitet
- `AUTH_SECRET`, `SMTP_ENCRYPTION_KEY`, `DATABASE_URL`, `AUTH_URL`, `STORAGE_PATH`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` sind gesetzt
- `prisma migrate deploy` und `prisma db seed` wurden auf Staging ausgefuehrt
- Es wurden keine Demo-Daten geladen
- SMTP-Zugangsdaten sind final oder produktionsnah
- Eine testbare DATEV-Zieladresse ist vorhanden
- Mindestens ein echter Testbenutzer fuer `USER` und ein `ADMIN` sind angelegt
- Ein oder mehrere Testbelege liegen als JPG, PNG und PDF vor

## Vorbereitungsprotokoll

Vor dem Lauf dokumentieren:
- Datum und Uhrzeit
- getestete Staging-URL
- Commit oder Build-Stand
- verantwortliche Person
- verwendete Testkonten
- verwendete DATEV-Testadresse
- verwendeter SMTP-Server

## Technischer Vorcheck

1. Staging-Deployment aktualisieren.
2. Datenbankmigrationen ausfuehren:
```bash
npx prisma migrate deploy
```
3. Basis-Seed ausfuehren:
```bash
npx prisma db seed
```
4. Sicherstellen, dass kein Demo-Seed geladen wurde.
5. App starten oder Container hochfahren.
6. Gesundheitscheck durchfuehren:
- Login-Seite erreichbar
- geschuetzte Seiten ohne Session nicht frei erreichbar
- `npm run build` wurde fuer diesen Stand bereits erfolgreich ausgefuehrt

## Durchlauf A - Auth und Rechte

### A1 Passwort-Login
- Als Admin mit E-Mail/Passwort anmelden
- Erwartung: Login erfolgreich, Weiterleitung in die App
- Pruefen: keine Preisgabe sensibler Daten im UI

### A2 PIN-Login
- Als dafuer vorbereiteter Benutzer mit E-Mail und PIN anmelden
- Erwartung: Login erfolgreich
- Danach 5 Fehlversuche mit falscher PIN simulieren
- Erwartung: temporaere Sperre greift

### A3 Rollenmodell
- Als `USER` pruefen, dass Admin-Bereiche nicht erreichbar sind
- Als `ADMIN` pruefen, dass Benutzer-, SMTP-, DATEV- und Reporting-Bereiche erreichbar sind
- Als `USER` pruefen, dass nur eigene Belege sichtbar sind

## Durchlauf B - Stammdaten und Einstellungen

### B1 Stammdaten
- Laender, Zwecke, Kategorien und Kfz oeffnen
- Erwartung: vorhandene Stammdaten sichtbar, aktive Werte in Erfassungsformularen nutzbar
- Optional: einen Eintrag deaktivieren und pruefen, dass alte Belege intakt bleiben

### B2 SMTP
- SMTP-Konfiguration oeffnen
- Erwartung: Passwort nur maskiert sichtbar
- SMTP-Testmail senden
- Erwartung: Testmail kommt an oder SMTP gibt einen klaren Fehler zurueck

### B3 DATEV
- DATEV-Profile oeffnen
- Erwartung: mindestens ein aktives Profil vorhanden
- Standardprofil markieren oder pruefen
- Platzhalter in Betreff und Body kontrollieren

## Durchlauf C - Beleg neu erfassen

### C1 Standardbeleg mit Bild
- Als `USER` oder `ADMIN` neuen Beleg anlegen
- Originaldatei als JPG oder PNG hochladen
- Erwartung: Upload erfolgreich, OCR startet
- Pruefen: OCR befuellt nur Vorschlaege, manuelle Eingaben bleiben erhalten
- Zweck, Kategorie und weitere Felder setzen
- Speichern
- Erwartung: Detailseite erscheint, Original bleibt abrufbar

### C2 Bewirtungsbeleg
- Neuen Beleg mit Zweck `Bewirtung` anlegen
- Anlass, Gaeste und Ort leer lassen und speichern versuchen
- Erwartung: Validierung blockiert den Speichervorgang
- Pflichtfelder ausfuellen und speichern
- Erwartung: Detailseite, Druckansicht und PDF zeigen Bewirtungsblock

### C3 Fremdwaehrungsbeleg
- Neuen Beleg mit Nicht-EUR-Waehrung anlegen
- Wechselkurs und Kursdatum setzen
- Speichern
- Erwartung: EUR-Betrag plausibel berechnet, Waehrungsblock in Detail/PDF sichtbar

### C4 PDF-Original
- Neuen Beleg mit PDF-Original anlegen
- Erwartung: Upload funktioniert, OCR liefert keinen belastbaren Text und die Erfassung bleibt manuell moeglich

## Durchlauf D - Review, Versand und Retry

### D1 Review-Workflow
- `USER`: Beleg zur Pruefung einreichen
- Erwartung: `DRAFT -> IN_REVIEW`
- `ADMIN`: Beleg freigeben
- Erwartung: `IN_REVIEW -> APPROVED`
- Optional: zurueckstellen und wieder oeffnen pruefen
- Erwartung: nur erlaubte Uebergaenge funktionieren

### D2 Versand
- Freigegebenen Beleg senden
- Erwartung: `OPEN -> READY -> SENT` oder bei Fehler `FAILED`
- Detailseite oeffnen
- Pruefen: SendLog-Eintrag vorhanden, Zieladresse korrekt, Originaldatei angehaengt

### D3 Retry
- Einen Versandfehler provozieren oder einen fehlgeschlagenen Beleg verwenden
- `Erneut senden` ausloesen
- Erwartung: Retry-Pfad funktioniert, Log zeigt mehrere Versuche

## Durchlauf E - Liste, Filter, Export, Reporting

### E1 Suche und Filter
- Belegliste oeffnen
- Volltextsuche testen
- Filter nach Benutzer, Land, Kfz, Zweck, Kategorie, Zeitraum und `reviewStatus` testen
- Erwartung: Ergebnismenge ist plausibel und konsistent

### E2 CSV-Export
- Als Admin denselben Filterzustand exportieren
- Erwartung: CSV spiegelt denselben Datenbestand wie die UI
- Pruefen: `Pruefstatus` und `Versandstatus` getrennt und plausibel

### E3 Reporting
- Reporting oeffnen
- Erwartung: EUR-Summen, Fremdwaehrungsanzahl und Originalsummen je Waehrung sind fachlich nachvollziehbar
- Keine zusammengeworfene Originalwaehrungs-Gesamtsumme als EUR interpretierbar

## Durchlauf F - Druck und Archivsicht

### F1 Detailansicht
- Originalbeleg sichtbar
- strukturierte Metadaten sichtbar
- Warnungen bei fehlender Originaldatei oder fehlenden Daten plausibel

### F2 Druckansicht
- HTML-Druckansicht oeffnen
- Erwartung: DIN-A4-tauglich, klare Trennung zwischen Original und strukturierter Darstellung

### F3 PDF-Download
- PDF herunterladen
- Erwartung: Datei oeffnet sich, Belegdaten sind enthalten, Bewirtungs- und Waehrungsblock werden bedingt korrekt angezeigt

## Abschlussbewertung des Staging-Laufs

Nach dem Durchlauf dokumentieren:
- bestandene Teilbereiche
- fehlgeschlagene Teilbereiche
- bekannte Restrisiken
- konkrete Blocker fuer Go-Live
- Freigabeentscheidung:
  - nicht staging-faehig
  - staging-faehig mit Auflagen
  - staging-faehig ohne Blocker

## Ergebnisvorlage

- Datum:
- URL:
- Build-/Commit-Stand:
- Getestet von:
- Admin-Login: bestanden / nicht bestanden
- PIN-Login: bestanden / nicht bestanden
- Stammdaten: bestanden / nicht bestanden
- Erfassung: bestanden / nicht bestanden
- Bewirtung: bestanden / nicht bestanden
- Versand: bestanden / nicht bestanden
- Retry: bestanden / nicht bestanden
- Filter/Export: bestanden / nicht bestanden
- Reporting: bestanden / nicht bestanden
- Druck/PDF: bestanden / nicht bestanden
- Offene Blocker:
- Empfehlung:
