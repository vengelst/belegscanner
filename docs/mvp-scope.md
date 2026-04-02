# BelegBox - MVP Scope

Stand: 2026-04-02
Quelle: `docs/ARCHITECTURE.md` ist die verbindliche Grundlage.

## Grundsatz

Die Zielarchitektur definiert das Gesamtbild. Umgesetzt wird in kleinen, kommittierbaren Paketen. Dieses Dokument beschreibt den Scope und den aktuellen Umsetzungsstand.

## MVP-Status: Fachlich abgeschlossen

Alle 8 Pakete sind umgesetzt. Der MVP deckt den vollstaendigen Workflow ab:
Beleg erfassen, strukturieren, speichern, an DATEV senden, drucken.

## Umgesetzte Pakete

### Paket 1: Projektsetup + Datenbank
- Next.js 15, TypeScript strict, Tailwind CSS 4
- Prisma-Schema mit allen Modellen
- PostgreSQL-Migration
- Seed-Daten fuer Zwecke, Kategorien, Laender

### Paket 2: Auth und Session-Handling
- Login mit E-Mail + Passwort (NextAuth v5, JWT)
- PIN-Login fuer Kiosk-Modus mit Rate-Limiting
- Rollen: Admin, User
- Benutzerverwaltung (CRUD, PIN setzen, deaktivieren)
- Eigenes Passwort und eigene PIN aendern
- Geschuetzte Bereiche (Middleware + serverseitiger Rollenschutz)

### Paket 3: Einstellungen und Stammdaten
- Stammdaten-CRUD: Laender, Kfz, Zwecke, Kategorien
- Versandstatus als systemgefuehrte Enum-Ansicht
- SMTP-Konfiguration mit verschluesselter Passwort-Speicherung
- SMTP-Testversand
- DATEV-Profile (mehrere, Default-Markierung, Templates)
- Admin-Sidebar mit gruppierten Links

### Paket 4: Belegerfassung mit Upload und OCR
- Datei-Upload (JPG, PNG, PDF, max 20 MB)
- Kamera-tauglicher Upload (capture="environment")
- OCR mit Tesseract.js (Datum, Betrag, Waehrung, Lieferant)
- Formular mit Stammdaten-Dropdowns
- Bewirtungsfelder dynamisch bei isHospitality
- Beleg-Detail und Beleg-Bearbeitung
- Belegliste mit mobile Cards und Desktop-Tabelle

### Paket 5: SMTP- und DATEV-Versand
- Mail-Service mit Template-Engine
- DATEV-Profil-Auswahl
- Statusfluss: OPEN -> READY -> SENT / FAILED, RETRY
- SendLog-Protokollierung aller Versandversuche
- Versand und Retry per UI-Aktion
- Validierung aller Voraussetzungen vor Versand

### Paket 6: Belegliste, Suche, Filter
- Volltextsuche ueber Lieferant, Bemerkung, OCR-Text
- Status-Quick-Filter als Chips
- Erweiterte Filter: Zweck, Kategorie, Land, Kfz, Benutzer, Zeitraum
- URL-basierte Filter (bookmarkbar)
- Pagination (20 pro Seite)
- Responsive: Mobile Cards + Desktop-Tabelle mit allen Feldern

### Paket 7: DIN-A4-Druckansicht
- HTML-Druckansicht (/receipts/[id]/print) mit A4-Layout
- Server-side PDF-Generierung mit @react-pdf/renderer
- PDF-Download ueber /api/receipts/[id]/pdf
- Bewirtungsblock und Waehrungsblock bedingt
- Druckansicht unabhaengig vom UI-Theme (immer hell)

### Paket 8: MVP-Feinschliff und Abschluss
- Server-seitige Bewirtungs-Validierung (POST + PUT)
- "Speichern & Senden" in Belegerfassung
- Warnungen in Detailansicht (fehlende Bewirtung, fehlende Datei, fehlender Kurs)
- Erweiterte Send-Validierung (Hospitality-Inhalte)
- Test-Checkliste (docs/testing-checklist.md)
- Offene-Punkte-Dokumentation (docs/open-items.md)

## Nicht Teil des MVP

Siehe `docs/open-items.md` fuer die vollstaendige Liste. Wichtigste Punkte:
- Docker-Compose Deployment
- Wechselkurs-API
- PDF als DATEV-Anhang
- Batch-Versand
- Dashboard
- Audit-Log-Aktivierung
- Export-Funktionen

## Naechste Ausbaustufen

1. Docker-Compose + HTTPS-Deployment
2. Wechselkurs-API (frankfurter.app)
3. PDF im DATEV-Versand
4. Admin-Dashboard mit Zaehler
5. PostgreSQL-Volltextsuche
