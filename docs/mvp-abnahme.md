# BelegBox - MVP-Abnahme

Stand: 2026-04-03
Version: 1.0.0 RC

## MVP-Status: staging-faehig, mit Restpunkten vor Go-Live

Die priorisierten Audit-Punkte 1 bis 10 sind umgesetzt. Der aktuelle Stand ist fuer ein kontrolliertes Staging tragfaehig; fuer Go-Live bleiben noch betriebliche und nicht priorisierte Produktentscheidungen ausserhalb dieses Durchgangs relevant.

Smart Capture ist bis Phase 5 integriert und fuer einen echten internen Praxiseinsatz geeignet, bleibt aber bewusst review-pflichtig und heuristisch.

## Abnahmekriterien

### Authentifizierung
- [x] Login mit E-Mail + Passwort
- [x] Login mit 4-stelliger PIN (Kiosk)
- [x] PIN-Brute-Force-Schutz (5 Versuche, 5 Min Sperre)
- [x] JWT-basierte Session
- [x] Rollenbasierter Zugriff (ADMIN/USER)
- [x] Middleware schuetzt alle Routen ausser /login

### Benutzerverwaltung
- [x] Benutzer CRUD (Admin)
- [x] Rollen zuweisen/wechseln
- [x] PIN setzen/entfernen (Admin)
- [x] Eigenes Passwort aendern
- [x] Eigene PIN aendern
- [x] Benutzer deaktivieren (Soft-Delete)
- [x] Eigenen Account nicht deaktivierbar

### Stammdaten
- [x] Laender: CRUD mit ISO-Code und Waehrungscode
- [x] Kfz: CRUD mit Kennzeichen und Beschreibung
- [x] Zwecke: CRUD mit Bewirtungs-Flag
- [x] Kategorien: CRUD
- [x] Versandstatus: Read-only Referenzseite
- [x] Soft-Delete (active-Flag)
- [x] Sortierreihenfolge pflegbar

### SMTP und DATEV
- [x] SMTP-Konfiguration (verschluesseltes Passwort)
- [x] SMTP-Testversand
- [x] DATEV-Profile (mehrere, Default-Markierung)
- [x] Betreff- und Body-Templates mit Platzhaltern
- [x] Profil-Auswahl beim Versand

### Belegerfassung
- [x] Datei-Upload (JPG, PNG, PDF)
- [x] Kamera-tauglicher Upload (capture="environment")
- [x] Datei-Validierung (Typ + Groesse)
- [x] OCR mit Tesseract.js (Datum, Betrag, Waehrung, Lieferant)
- [x] OCR-Ergebnisse als Formular-Vorbelegung
- [x] Alle Pflichtfelder: Datum, Betrag, Waehrung, Zweck, Kategorie
- [x] Optionale Felder: Land, Kfz, Lieferant, Bemerkung, Wechselkurs
- [x] "Speichern" und "Speichern & Senden"
- [x] Beleg bearbeiten

### Bewirtungslogik
- [x] Dynamische Pflichtfelder bei isHospitality-Zweck
- [x] Client-seitige Validierung (required-Attribute)
- [x] Server-seitige Validierung (POST + PUT)
- [x] Server verhindert Loeschen bei Bewirtungszweck
- [x] Bewirtungsdaten in Detail, Druck und PDF

### Versand
- [x] Manueller Versand ("Jetzt senden")
- [x] Automatischer Versand ("Speichern & Senden")
- [x] Retry bei Fehler ("Erneut senden")
- [x] Statusfluss: OPEN -> READY -> SENT/FAILED, RETRY
- [x] SendLog-Protokollierung
- [x] Voraussetzungspruefung vor Versand
- [x] E-Mail mit Originaldatei als Anhang

### Belegliste
- [x] Volltextsuche (Lieferant, Bemerkung, OCR-Text)
- [x] Status-Quick-Filter
- [x] Erweiterte Filter (Zweck, Kategorie, Land, Kfz, Benutzer, Zeitraum)
- [x] Pagination (20 pro Seite)
- [x] Mobile Cards + Desktop-Tabelle
- [x] URL-basierte Filter

### Detailansicht
- [x] Originalbeleg-Vorschau (Bild/PDF)
- [x] Alle Belegdaten
- [x] Versandstatus und -historie
- [x] Bewirtungs- und Waehrungsblock
- [x] OCR-Rohtext
- [x] Warnungen bei unvollstaendigen Daten
- [x] Aktionen: Bearbeiten, Druckansicht, PDF, Senden

### Druckansicht
- [x] HTML-Druckansicht (A4, browser-print-optimiert)
- [x] Server-side PDF mit @react-pdf/renderer
- [x] PDF-Download ueber API-Route
- [x] Bewirtungs- und Waehrungsblock bedingt
- [x] Theme-unabhaengig (immer hell)

### Dashboard
- [x] Belegzaehler (gesamt, offen, gesendet, fehlgeschlagen)
- [x] Benutzer, SMTP-Status, DATEV-Profile

### Sicherheit
- [x] Passwoerter bcrypt-gehasht (Cost 12)
- [x] PINs bcrypt-gehasht
- [x] SMTP-Passwort AES-256-GCM-verschluesselt
- [x] Alle API-Routen authentifiziert
- [x] Admin-Routen zusaetzlich rollengeprueft
- [x] Dateizugriff owner-geprueft
- [x] SMTP-Passwort maskiert in API-Response
- [x] Brute-Force-Schutz fuer E-Mail/Passwort-Login

## Auditbedingte Einschraenkungen

- PDF-OCR ist umgesetzt: Text-PDFs werden direkt gelesen. Der Scan-PDF-Fallback ueber die ersten drei Seiten ist implementiert, laut Audit vom 03.04.2026 aber noch kein belastbar nachgewiesener Staging-Pfad.
- Batch-Versand und weitergehende Betriebsautomatisierung sind weiterhin ausserhalb des MVP.
- Ein echter Staging-Durchlauf mit finaler Infrastruktur- und Mailkonfiguration steht weiterhin aus.

## Freigabeentscheidung

- Entwicklungsfaehig: ja
- Intern testfaehig: ja
- Staging-faehig: nur eingeschraenkt; fuer die allgemeine App ja, fuer die PDF-Rechnungsanalyse mit Scan-PDFs noch nicht belastbar bestaetigt
- Go-live-faehig: noch nicht belastbar bestaetigt

## Voraussetzungen fuer Produktivbetrieb

1. PostgreSQL-Datenbank einrichten
2. `.env` mit echten Werten konfigurieren (insbesondere AUTH_SECRET, SMTP_ENCRYPTION_KEY)
3. `npx prisma migrate deploy` ausfuehren
4. `npx prisma db seed` ausfuehren
5. SMTP-Einstellungen im Admin-Bereich konfigurieren
6. Mindestens ein DATEV-Profil anlegen
7. HTTPS einrichten (erforderlich fuer Kamera-Zugriff auf Mobilgeraeten)
8. `npm run build && npm run start`

## Bekannte Einschraenkungen

Siehe `docs/open-items.md`, `docs/app-findings.md` und `docs/app-risk-assessment.md`.
