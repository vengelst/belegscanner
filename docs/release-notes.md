# BelegBox - Release Notes

> Hinweis: ZWISCHENSTAND: Historische Release-Notes eines frueheren Zwischenstands. Nicht als aktuelle Betriebs- oder Freigabebewertung verwenden.


## Version 1.0.0 (Release Candidate)

Datum: 2026-04-02

---

### Uebersicht

Erstes vollstaendiges Release der BelegBox -- einer webbasierten Beleg-App fuer mobile Erfassung, strukturierte Verwaltung und DATEV-Versand per E-Mail.

### Enthaltene Funktionen

**Authentifizierung**
- Login mit E-Mail und Passwort
- PIN-Login fuer Kiosk-Modus (4-stellig, mit Brute-Force-Schutz)
- Rollenmodell: Admin und User
- JWT-basierte Sessions

**Benutzerverwaltung**
- Benutzer anlegen, bearbeiten, deaktivieren (Admin)
- Rollen zuweisen, PIN setzen/entfernen
- Eigenes Passwort und eigene PIN aendern

**Stammdaten**
- Laender (mit ISO-Code und Waehrungscode)
- Kfz-Kennzeichen
- Zwecke (mit Bewirtungs-Flag)
- Kategorien
- Versandstatus (systemgefuehrt, Read-only-Referenz)

**Belegerfassung**
- Upload von JPG, PNG und PDF (max. 20 MB)
- Kamera-tauglicher Upload fuer Mobilgeraete
- OCR-Erkennung per Tesseract.js (Datum, Betrag, Waehrung, Lieferant)
- OCR-Ergebnisse fliessen automatisch in Formularfelder
- Bewirtungsfelder dynamisch bei Bewirtungszweck
- Fremdwaehrung mit Wechselkurs und EUR-Berechnung
- "Speichern" und "Speichern & Senden"

**DATEV-Versand**
- SMTP-Konfiguration mit verschluesseltem Passwort (AES-256-GCM)
- SMTP-Testversand
- Mehrere DATEV-Profile mit Betreff-/Body-Templates
- Statusfluss: OPEN -> READY -> SENT / FAILED, RETRY
- Versandprotokoll (SendLog) mit Historie
- Retry bei fehlgeschlagenem Versand

**Belegliste**
- Volltextsuche (Lieferant, Bemerkung, OCR-Text)
- Status-Quick-Filter
- Erweiterte Filter (Zweck, Kategorie, Land, Kfz, Benutzer, Zeitraum)
- Pagination (20 pro Seite)
- Responsive: Mobile Cards + Desktop-Tabelle

**Detailansicht**
- Originalbeleg-Vorschau (Bild inline, PDF als iframe)
- Alle Belegdaten, Versandstatus, Versandhistorie
- Bewirtungs- und Waehrungsblock bedingt
- Warnungen bei unvollstaendigen Daten
- Aktionen: Bearbeiten, Druckansicht, PDF, Senden, Erneut senden

**Druckansicht**
- HTML-Druckansicht (DIN-A4, browser-print-optimiert)
- Server-side PDF-Generierung mit @react-pdf/renderer
- Bewirtungs- und Waehrungsblock bedingt
- Theme-unabhaengig (immer helles Drucklayout)

**Administration**
- Dashboard mit Belegzaehlern und Systemstatus
- SMTP- und DATEV-Konfiguration
- Stammdatenverwaltung mit Sortierung und Soft-Delete

**Infrastruktur**
- Docker Compose fuer lokales und Staging-Deployment
- Standalone-Build fuer Docker
- Demo-Daten im Seed (5 Belege, 2 Benutzer, DATEV-Profil)

### Behobene Fehler (UAT)

| ID | Beschreibung |
|---|---|
| BUG-001 | Race Condition bei "Speichern & Senden" |
| BUG-002 | Falsche EUR-Berechnung bei Beleg-Bearbeitung (Decimal-Casting) |
| BUG-003 | SMTP ohne Passwort bei Ersteinrichtung moeglich |
| BUG-004 | Mehrdeutige Passwort-/Profil-Erkennung in User-API |
| BUG-005 | OCR-Text ohne Validierung in Datenbank |
| BUG-006 | Verwaiste Datei-Eintraege bei erneutem Upload |
| BUG-007 | Null-Anzeige bei fehlender Fehler-Nachricht |

### Behobene UX-Probleme (Post-UAT)

| Problem | Loesung |
|---|---|
| OCR-Ergebnisse wurden nicht in Formularfelder uebernommen | Kontrollierte Inputs mit useEffect-Sync |
| Betragsfelder zeigten Punkt statt Komma | Locale-gerechte Anzeige im Edit-Formular |

### Bekannte Einschraenkungen

- OCR nur fuer Bilder (JPG/PNG), nicht fuer PDFs
- Wechselkurse muessen manuell eingegeben werden
- Einzelversand (kein Batch)
- AuditLog-Modell vorhanden, aber nicht aktiv befuellt
- HTTPS erforderlich fuer Kamera-Zugriff auf Mobilgeraeten

### Empfohlene erste Tests nach Deployment

1. Login mit Admin-Benutzer
2. SMTP konfigurieren und Test-Mail senden
3. DATEV-Profil pruefen
4. JPG-Beleg hochladen, OCR-Vorbelegung pruefen
5. Beleg speichern, dann senden
6. Versandstatus und -historie in Detailansicht pruefen
7. Druckansicht und PDF herunterladen
8. Bewirtungsbeleg erstellen und validieren
