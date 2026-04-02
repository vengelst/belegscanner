# BelegBox - App Inventory

Stand: 2026-04-02
Basis: Codebestand in `src/`, `prisma/`, `docs/`, lokale Build-/Lint-/Typecheck-Pruefung

## Ist-Zustand

Die App ist kein Rohbau mehr. Es existiert ein weitgehend durchgaengiger Monolith auf Basis von Next.js App Router mit Prisma, PostgreSQL-Anbindung, Auth, Stammdaten, Belegworkflow, Versand, Druckansicht und Reporting.

## Tatsaechlich vorhandene Module und Funktionen

### Architektur und Struktur
- Next.js 15 App Router unter `src/app`
- Prisma-Datenmodell und Migrationen unter `prisma/`
- Gemeinsame Server-Utilities unter `src/lib`
- Komponentenbasierte UI unter `src/components`
- Dokumentation fuer Setup, Deployment, UAT, Go-Live, Workflow und offene Punkte unter `docs/`

### Datenmodell
- Stammdaten: `Country`, `Vehicle`, `Purpose`, `Category`
- Benutzer und Rollen: `User`, `Role`
- Belege: `Receipt`, `Hospitality`, `ReceiptFile`, `ReceiptComment`
- Versand und Konfiguration: `SmtpConfig`, `DatevProfile`, `SendLog`
- Workflow-/Pruefstatus: `SendStatus`, `ReviewStatus`
- Audit-Modell vorhanden: `AuditLog`

### Auth und Rollen
- Login mit E-Mail/Passwort
- PIN-Login ueber E-Mail + 4-stellige PIN
- JWT-Session via NextAuth v5
- Middleware-Schutz fuer App-Routen
- Rollenschutz fuer Admin-APIs und Admin-Layouts
- Passwort- und PIN-Aenderung fuer Benutzer
- PIN-Verwaltung durch Admin

### Stammdaten und Einstellungen
- CRUD fuer Laender, Kfz, Zwecke, Kategorien
- Versandstatus-Referenzseite
- SMTP-Konfiguration inkl. Testversand
- DATEV-Profile mit Default-Markierung und Aktiv/Inaktiv-Logik
- Benutzerverwaltung inkl. Aktiv/Inaktiv und Rollenwechsel

### Belegworkflow
- Beleganlage
- Belegbearbeitung
- Belegdetailseite
- Such- und Filterliste mit Pagination
- Upload fuer JPG, PNG und PDF
- OCR fuer Bilder
- Dynamische Bewirtungslogik
- Kommentare je Beleg
- Review-Workflow mit `DRAFT`, `IN_REVIEW`, `APPROVED`, `DEFERRED`, `COMPLETED`
- Versand einzeln, Retry und Send-Log

### Druck und Export
- HTML-Druckansicht
- Serverseitige PDF-Generierung
- CSV-Export fuer Admin
- Reporting-Seite mit Kennzahlen und Gruppierungen

## Teilweise vorhanden oder nur vorbereitet

### OCR
- Bilder werden analysiert.
- PDFs werden akzeptiert, liefern aber bewusst kein OCR-Ergebnis.

### Audit / Nachvollziehbarkeit
- `AuditLog` existiert im Schema.
- Eine konsequente Befuellung der Audit-Logs ist noch nicht aktiv.

### DATEV-/Versandlogik
- Versand per SMTP mit Originaldatei funktioniert im Codepfad.
- Generiertes PDF wird derzeit nicht als zweiter DATEV-Anhang versendet.

### Produktionsreife
- Build, Lint und Typecheck laufen grundsaetzlich.
- `next build` ist aber an reale Datenbankerreichbarkeit gekoppelt, weil mehrere Seiten waehrend des Builds Prisma-Queries ausfuehren.

## Doppelstrukturen, Altlasten oder Inkonsistenzen

- Doku bewertet die App als Release Candidate mit bestandener UAT, waehrend im Code noch relevante Sicherheits- und Betriebsrisiken bestehen.
- `docs/open-items.md` nennt Export-Funktionen als nicht im MVP, obwohl CSV-Export bereits vorhanden ist.
- UI und API filtern Belege nicht vollstaendig konsistent: UI/Page kennt `reviewStatus`, API-Liste und CSV-Export nicht durchgaengig.
- `README.md` ist als Einstieg fast leer und deckt den realen Projektumfang nicht ab.
- Seed-Daten enthalten neben Stammdaten auch Demo-Benutzer, Demo-PIN und Demo-Belege.

## Direkt umgesetzte Kleinfixes im Audit

- Upload-Endpunkt prueft jetzt Eigentum/Adminrolle vor dem Ersetzen von Originaldateien.
- `typecheck` erzeugt jetzt vorher Route-Typen und ist damit reproduzierbarer.
