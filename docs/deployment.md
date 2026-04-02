# BelegBox - Deployment

## Grundsatz

Der Standard-Seed ist produktionsnah und legt nur Stammdaten sowie optional einen env-gesteuerten Initial-Admin an. Demo-Daten muessen getrennt und explizit geladen werden.

## Option A: Docker Compose

### Voraussetzungen
- Docker und Docker Compose
- freie Ports fuer App und PostgreSQL

### Start

```bash
# .env mit echten Werten vorbereiten
docker compose up -d

docker compose exec app npx prisma migrate deploy
docker compose exec app npx prisma db seed
```

Optional nur fuer lokale Demo- oder UAT-Umgebungen:

```bash
docker compose exec app npx tsx prisma/seed-demo.ts
```

## Option B: Bare Metal / VPS

```bash
npm ci
cp .env.example .env
# echte Werte setzen

npx prisma generate
npx prisma migrate deploy
npx prisma db seed
npm run build
npm run start
```

Optional nur fuer Demo-Umgebungen:

```bash
npm run prisma:seed:demo
```

## Produktionsanforderungen

- `DATABASE_URL` zeigt auf die echte PostgreSQL-Instanz.
- `AUTH_SECRET` und `SMTP_ENCRYPTION_KEY` sind echt generiert.
- `AUTH_URL` zeigt auf die produktive Basis-URL.
- `STORAGE_PATH` ist persistent und beschreibbar.
- `ADMIN_EMAIL` und `ADMIN_PASSWORD` sind vor dem Seed gesetzt, wenn ein Initial-Admin erzeugt werden soll.
- HTTPS ist fuer Kamera-Uploads auf Mobilgeraeten erforderlich.

## Betriebsnotizen

- `npm run build` sollte ohne produktive Datenzugriffe im Build selbst reproduzierbar laufen.
- SMTP-Fehler werden in `SendLog` protokolliert.
- Demo-Daten nicht in Staging oder Produktion laden.
