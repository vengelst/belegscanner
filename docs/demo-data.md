# BelegBox - Demo-Daten

## Zweck

Der Demo-Seed ist nur fuer lokale Entwicklung, Demos und UAT gedacht.

## Befehle

Produktionsnaher Basis-Seed:

```bash
npm run prisma:seed
```

Optionaler Demo-Seed:

```bash
npm run prisma:seed:demo
```

## Was der Demo-Seed anlegt

- Admin mit lokalen Demo-Defaults, falls nicht bereits vorhanden
- Demo-User mit Passwort und PIN
- DATEV-Beispielprofil
- Beispielbelege inklusive Fremdwaehrung, Bewirtung und SendLogs

## Standardwerte im Demo-Pfad

- Admin: `admin@belegbox.local` / `admin1234`
- Demo: `demo@belegbox.local` / `demo1234`
- Demo-PIN: `1234`

Diese Werte koennen ueber `.env` ueberschrieben werden.

## Wichtig

- Nicht in Staging oder Produktion verwenden.
- Vor echten Abnahmen und echten Reporting-Pruefungen keine Demo-Daten in derselben Datenbank behalten.
