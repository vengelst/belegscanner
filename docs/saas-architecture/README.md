# BelegBox SaaS – Architektur-Dokumentation

Diese Dokumentation beschreibt die technische Architektur für die Umwandlung der Single-Tenant-App "BelegScanner" in die Multi-Tenant SaaS-Plattform "BelegBox".

## Dokumente

| # | Dokument | Beschreibung |
|---|----------|--------------|
| 0 | [Migrations-Strategie](./00-migration-strategy.md) | Wie die bestehende App kopiert und weiterentwickelt wird |
| 1 | [Tenant-Isolation](./01-tenant-isolation.md) | Technische Umsetzung der Mandantentrennung |
| 2 | [Billing-Flow](./02-billing-flow.md) | Stripe-Integration, Tarife, Abrechnung |
| 3 | [Onboarding-Flow](./03-onboarding-flow.md) | Registrierung, Setup-Wizard, Trial-Conversion |

## Lesereihenfolge

1. **00-migration-strategy.md** – Verstehen, wie die neue App aus der bestehenden entsteht
2. **01-tenant-isolation.md** – Kern der Multi-Tenancy-Architektur
3. **02-billing-flow.md** – Monetarisierung und Zahlungsabwicklung
4. **03-onboarding-flow.md** – Kundengewinnung und -aktivierung

## Technologie-Stack

| Komponente | Technologie |
|------------|-------------|
| Framework | Next.js 15 (App Router) |
| Sprache | TypeScript (strict) |
| Datenbank | PostgreSQL 16 |
| ORM | Prisma 6 |
| Auth | NextAuth.js v5 |
| Payment | Stripe |
| E-Mail | Nodemailer |
| Deployment | Docker + Nginx |

## Zeitliche Einordnung

```
┌────────────────────────────────────────────────────────────────────┐
│                      ENTWICKLUNGS-PHASEN                           │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  Phase 1        Phase 2         Phase 3        Phase 4    Phase 5 │
│  ────────       ────────        ────────       ────────   ─────── │
│  Setup &        Multi-          Billing        Onboarding Testing │
│  Rebranding     Tenancy                                   & Launch│
│                                                                    │
│  ████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
│                                                                    │
│  Voraussetzung  Kernfunktion   Monetarisierung Wachstum   Go-Live │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

## Schnellstart für Entwickler

```bash
# 1. Repository klonen
git clone https://github.com/vengelst/belegbox.git
cd belegbox

# 2. Dependencies installieren
npm install

# 3. Umgebungsvariablen setzen
cp .env.example .env.local
# .env.local bearbeiten

# 4. Datenbank migrieren
npx prisma migrate dev

# 5. Entwicklungsserver starten
npm run dev
```

## Offene Fragen

- [ ] Genauer Produktname: "BelegBox" oder anders?
- [ ] Domain: belegbox.de verfügbar?
- [ ] Zielgruppe: Nur Handwerk oder breiter?
- [ ] Preisgestaltung: Preise bestätigen
- [ ] Rechtliches: AGB, Datenschutz, Impressum

---

*Erstellt: August 2026*
