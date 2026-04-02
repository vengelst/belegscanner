# BelegBox

BelegBox ist eine webbasierte Beleg-App auf Basis von Next.js, TypeScript, Tailwind, Prisma und PostgreSQL.

## Aktueller Stand

- Login mit E-Mail/Passwort und PIN
- Benutzer- und Stammdatenverwaltung
- Belegerfassung mit Originaldatei, OCR-Vorbelegung fuer Bilder und PDFs, Benutzer-Defaults, Folgeerfassung und mobiler Kameraaufnahme
- Review-, Versand- und Druck/PDF-Pfade
- PDF-OCR: Text-PDFs direkt, Scan-PDFs ueber Seitenbild-OCR (erste Seiten)
- Smart Capture Phase 4: strukturierte OCR-Feldzuordnung mit Laendererkennung, robusterer Zahlungsart-/Kartenmuster-Erkennung und leichtgewichtigem Feldstatusmodell fuer Review und manuelle Bestaetigung
- Reporting, CSV-Export und Admin-Bereiche
- Komfortfunktionen: letzte Werte merken, Standard-Zuordnungen pro Benutzer, "Speichern & naechsten Beleg erfassen"

## Schnellstart

1. `.env.example` nach `.env` kopieren und mindestens `DATABASE_URL`, `AUTH_SECRET`, `SMTP_ENCRYPTION_KEY`, `ADMIN_EMAIL` und `ADMIN_PASSWORD` setzen.
2. `npm install`
3. `npm run prisma:migrate`
4. `npm run prisma:seed`
5. Optional fuer Demo-Zugaenge und Beispielbelege: `npm run prisma:seed:demo`
6. `npm run dev`

## Wichtige Seed-Regeln

- `npm run prisma:seed` legt nur Stammdaten und optional einen env-gesteuerten Initial-Admin an.
- `npm run prisma:seed:demo` legt zusaetzlich Demo-User, Demo-PIN, DATEV-Beispielprofil und Demo-Belege an.
- Demo-Daten gehoeren nicht in Staging oder Produktion.

## Wichtige Scripts

- `npm run dev`: lokaler Entwicklungsserver
- `npm run build`: Produktions-Build
- `npm run start`: Produktionsserver
- `npm run lint`: Linting
- `npm run typecheck`: TypeScript-Pruefung
- `npm run prisma:migrate`: Prisma-Migrationen lokal ausfuehren
- `npm run prisma:seed`: produktionsnaher Basis-Seed
- `npm run prisma:seed:demo`: optionale Demo-Daten

## Dokumentation

- [Lokales Setup](docs/setup.md)
- [Deployment](docs/deployment.md)
- [Go-Live-Checkliste](docs/go-live-checklist.md)
- [Demo-Daten](docs/demo-data.md)
- [Betriebsleitfaden](docs/operating-guide.md)
- [MVP-Abnahme](docs/mvp-abnahme.md)
- [Audit-Findings](docs/app-findings.md)
- [Priorisierte Massnahmen](docs/app-priorities.md)
