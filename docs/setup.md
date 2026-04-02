# BelegBox - Lokales Setup

## Voraussetzungen

- Node.js >= 20
- PostgreSQL >= 15
- npm

## 1. Repository und Dependencies

```bash
git clone <repo-url>
cd belegscanner
npm install
```

## 2. Umgebungsvariablen

```bash
cp .env.example .env
```

Mindestens setzen:
- `DATABASE_URL`
- `AUTH_SECRET`
- `SMTP_ENCRYPTION_KEY`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`

`ADMIN_NAME` ist optional. Ohne `ADMIN_EMAIL` und `ADMIN_PASSWORD` legt der Standard-Seed keinen Initial-Admin an.

## 3. Datenbank starten

Beispiel mit Docker:

```bash
docker run -d --name belegbox-db   -e POSTGRES_USER=postgres   -e POSTGRES_PASSWORD=postgres   -e POSTGRES_DB=belegbox   -p 5432:5432   postgres:16
```

## 4. Prisma einrichten

```bash
npm run prisma:migrate
npm run prisma:seed
```

Optional fuer lokale Demos und UAT mit Beispielzugaengen:

```bash
npm run prisma:seed:demo
```

## 5. Entwicklungsserver starten

```bash
npm run dev
```

App: `http://localhost:3000`

## 6. Login

Nach `npm run prisma:seed` gibt es nur dann einen initialen Admin, wenn `ADMIN_EMAIL` und `ADMIN_PASSWORD` in `.env` gesetzt sind.

Nach `npm run prisma:seed:demo` stehen zusaetzlich diese Demo-Zugaenge bereit:

| Benutzer | E-Mail | Passwort | Rolle |
|---|---|---|---|
| Admin | `ADMIN_EMAIL` aus `.env` oder `admin@belegbox.local` | `ADMIN_PASSWORD` aus `.env` oder `admin1234` | ADMIN |
| Demo | `DEMO_USER_EMAIL` oder `demo@belegbox.local` | `DEMO_USER_PASSWORD` oder `demo1234` | USER |

PIN-Login fuer den Demo-User: `DEMO_USER_PIN` oder `1234`

## 7. Erste Schritte

1. Als Admin anmelden.
2. SMTP im Admin-Bereich konfigurieren.
3. Mindestens ein DATEV-Profil anlegen.
4. Einen neuen Beleg mit Originaldatei erfassen.
5. OCR-Vorschlaege pruefen und fachliche Felder ergaenzen.

## Scripts

| Script | Beschreibung |
|---|---|
| `npm run dev` | Entwicklungsserver |
| `npm run build` | Produktions-Build |
| `npm run start` | Produktionsserver |
| `npm run lint` | Linting |
| `npm run typecheck` | TypeScript-Pruefung |
| `npm run prisma:generate` | Prisma Client generieren |
| `npm run prisma:migrate` | Lokale Migrationen ausfuehren |
| `npm run prisma:seed` | Stammdaten und optionalen Initial-Admin laden |
| `npm run prisma:seed:demo` | Optionale Demo-Zugaenge und Demo-Belege laden |
| `npm run setup` | Generate + migrate + Standard-Seed |

## Wichtige Hinweise

- `npm run build` ist auf requestgebundene Dashboard-Seiten abgesichert und benoetigt keine Live-DB fuer statische Seitengenerierung.
- Kamera-Upload auf Mobilgeraeten benoetigt HTTPS.
- OCR verarbeitet Bilder direkt; Text-PDFs werden direkt gelesen, Scan-PDFs ueber die ersten Seiten per OCR analysiert.
