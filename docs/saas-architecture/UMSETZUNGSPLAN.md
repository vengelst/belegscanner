# Umsetzungsplan: BelegFlow SaaS

> **Hinweis:** "BelegFlow" ist ein Arbeitstitel. Der finale Name wird vor Phase 1 festgelegt.

## Namensvorschläge

| Name | Bewertung | Domain prüfen |
|------|-----------|---------------|
| **BelegFlow** ⭐ | Modern, Workflow-Bezug | belegflow.de |
| **BelegPilot** | KI/Autopilot-Assoziation | belegpilot.de |
| **Belegify** | Kurz, Startup-Vibe | belegify.de |
| **SmartBeleg** | KI-Bezug | smartbeleg.de |
| **BonDigital** | Selbsterklärend | bondigital.de |

**Prüfen unter:** https://webwhois.denic.de/

---

## Übersicht der Phasen

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                              │
│   PHASE 0      PHASE 1       PHASE 2       PHASE 3       PHASE 4           │
│   ────────     ────────      ────────      ────────      ────────           │
│   Vorbereitung Setup &       Multi-        Billing &     Testing &          │
│                Rebranding    Tenancy       Onboarding    Launch             │
│                                                                              │
│   ▓▓░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
│                                                                              │
│   Domain       Repository    Datenbank     Stripe        Beta-Test          │
│   Name         Fork          RLS           Tarife        Security           │
│   Hosting      Branding      API-Routes    Checkout      Go-Live            │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Phase 0: Vorbereitung (VOR dem Coding)

### Aufgaben

| # | Aufgabe | Verantwortlich | Status |
|---|---------|----------------|--------|
| 0.1 | **Produktname festlegen** | Entscheider | ⬜ |
| 0.2 | Domain registrieren (z.B. belegflow.de) | Entscheider | ⬜ |
| 0.3 | Stripe-Account erstellen | Entscheider | ⬜ |
| 0.4 | E-Mail-Service einrichten (Transaktions-E-Mails) | Entscheider | ⬜ |
| 0.5 | Tarife/Preise final festlegen | Entscheider | ⬜ |
| 0.6 | Rechtliche Dokumente (AGB, Datenschutz, Impressum) | Anwalt/Entscheider | ⬜ |
| 0.7 | Logo & Branding-Assets erstellen | Designer | ⬜ |

### Tarif-Vorlage zur Entscheidung

| | Starter | Business | Enterprise |
|---|---------|----------|------------|
| **Preis/Monat** | 19 € | 49 € | 149 € |
| **Benutzer** | 1 | 5 | Unbegrenzt |
| **Belege/Monat** | 100 | 500 | Unbegrenzt |
| **Speicher** | 1 GB | 10 GB | 100 GB |
| **KI-Analysen** | 50 | 250 | 1.000 |
| **DATEV-Export** | ✅ | ✅ | ✅ |
| **API-Zugang** | ❌ | ✅ | ✅ |
| **Support** | E-Mail | E-Mail + Chat | Priorität |

**Zu entscheiden:**
- [ ] Preise OK?
- [ ] Limits OK?
- [ ] Trial-Dauer: 14 Tage?
- [ ] Jährliche Zahlung: Rabatt? (z.B. 2 Monate gratis)

---

## Phase 1: Setup & Rebranding

### Aufgaben

| # | Aufgabe | Details | Geschätzt |
|---|---------|---------|-----------|
| 1.1 | Repository forken | `belegscanner` → `belegflow` | 30 Min |
| 1.2 | Rebranding durchführen | Namen, Logos, Konstanten | 2-3 Std |
| 1.3 | Neues Deployment aufsetzen | Docker-Stack, DB, Ports | 2-3 Std |
| 1.4 | Nginx konfigurieren | Wildcard-Subdomain | 1 Std |
| 1.5 | SSL-Zertifikat | Let's Encrypt Wildcard | 1 Std |
| 1.6 | CI/CD einrichten (optional) | GitHub Actions | 2 Std |
| 1.7 | Basis-Test | App startet, Login funktioniert | 1 Std |

### Technische Details

```bash
# 1.1 Repository forken
gh repo create belegflow --private
git clone https://github.com/vengelst/belegscanner.git belegflow
cd belegflow
git remote set-url origin https://github.com/vengelst/belegflow.git
git push -u origin main

# 1.2 Rebranding (automatisiert)
./scripts/rebrand.sh "BelegFlow"

# 1.3 Neues Deployment
# docker-compose.prod.yml anpassen:
# - Container: belegflow-app, belegflow-db
# - Ports: 3004, 55434
# - Volume: belegflow_postgres_data

# 1.5 SSL Wildcard
certbot certonly --manual --preferred-challenges=dns \
  -d "*.belegflow.de" -d "belegflow.de"
```

### Ergebnis Phase 1
- ✅ Neue App läuft unter `app.belegflow.de`
- ✅ Getrennt von BelegScanner
- ✅ Bereit für Multi-Tenancy

---

## Phase 2: Multi-Tenancy

### Aufgaben

| # | Aufgabe | Priorität | Geschätzt |
|---|---------|-----------|-----------|
| 2.1 | Prisma Schema erweitern | HOCH | 2-3 Std |
| 2.2 | Migration erstellen | HOCH | 1 Std |
| 2.3 | PostgreSQL RLS aktivieren | HOCH | 2-3 Std |
| 2.4 | Tenant-Middleware | HOCH | 2-3 Std |
| 2.5 | Prisma Client Extension | HOCH | 3-4 Std |
| 2.6 | Auth erweitern (Tenant in Session) | HOCH | 2-3 Std |
| 2.7 | **Alle API-Routes anpassen** | HOCH | 8-12 Std |
| 2.8 | Subdomain-Routing | MITTEL | 2-3 Std |
| 2.9 | Verschlüsselung pro Tenant | MITTEL | 4-6 Std |
| 2.10 | Audit-Logging erweitern | NIEDRIG | 2-3 Std |
| 2.11 | Isolation-Tests schreiben | HOCH | 4-6 Std |

### Kritischer Pfad: API-Routes (2.7)

```
Zu prüfende Routes:
├── /api/receipts/          (CRUD) → tenant_id
├── /api/receipts/[id]/     (Detail) → tenant_id Check
├── /api/users/             (nur eigener Tenant)
├── /api/vehicles/          → tenant_id
├── /api/purposes/          → tenant_id
├── /api/categories/        → tenant_id
├── /api/countries/         → tenant_id
├── /api/datev/             → tenant_id
├── /api/smtp/              → tenant_id (oder global?)
├── /api/settings/          → tenant_id
└── /api/upload/            → tenant_id (Dateipfad)
```

**Jede Route muss:**
1. Tenant aus Session lesen
2. Tenant-Prisma-Client verwenden
3. Bei CREATE: tenant_id setzen
4. Bei READ/UPDATE/DELETE: tenant_id prüfen

### Ergebnis Phase 2
- ✅ Komplette Mandantentrennung
- ✅ Kein Datenleck möglich
- ✅ Tests beweisen Isolation

---

## Phase 3: Billing & Onboarding

### Teil A: Billing

| # | Aufgabe | Priorität | Geschätzt |
|---|---------|-----------|-----------|
| 3.1 | Stripe-Produkte/Preise anlegen | HOCH | 1 Std |
| 3.2 | Billing-Tabellen (Prisma) | HOCH | 2 Std |
| 3.3 | Checkout-Flow | HOCH | 4-6 Std |
| 3.4 | Webhook-Handler | HOCH | 4-6 Std |
| 3.5 | Usage-Tracking | MITTEL | 3-4 Std |
| 3.6 | Limit-Checks | MITTEL | 2-3 Std |
| 3.7 | Customer Portal | NIEDRIG | 2 Std |
| 3.8 | Dunning E-Mails | NIEDRIG | 2-3 Std |

### Teil B: Onboarding

| # | Aufgabe | Priorität | Geschätzt |
|---|---------|-----------|-----------|
| 3.9 | Registrierungs-Formular | HOCH | 2-3 Std |
| 3.10 | E-Mail-Verifizierung | HOCH | 2-3 Std |
| 3.11 | Setup-Wizard (4 Schritte) | HOCH | 4-6 Std |
| 3.12 | Trial-System | HOCH | 2-3 Std |
| 3.13 | Trial-Reminder E-Mails | MITTEL | 2-3 Std |
| 3.14 | In-App Trial-Banner | MITTEL | 1-2 Std |
| 3.15 | Team-Einladung | MITTEL | 3-4 Std |
| 3.16 | First-Receipt-Guide | NIEDRIG | 2 Std |

### Teil C: Admin-Panel

| # | Aufgabe | Priorität | Geschätzt |
|---|---------|-----------|-----------|
| 3.17 | Superadmin-Login | HOCH | 1-2 Std |
| 3.18 | Tenant-Liste | HOCH | 2-3 Std |
| 3.19 | Tenant-Details | MITTEL | 2-3 Std |
| 3.20 | Billing-Übersicht | MITTEL | 2-3 Std |
| 3.21 | System-Statistiken | NIEDRIG | 2-3 Std |

### Ergebnis Phase 3
- ✅ Kunden können sich registrieren
- ✅ Trial funktioniert
- ✅ Zahlung über Stripe
- ✅ Admin kann System verwalten

---

## Phase 4: Testing & Launch

### Teil A: Testing

| # | Aufgabe | Priorität | Geschätzt |
|---|---------|-----------|-----------|
| 4.1 | E2E Tests (Playwright) | HOCH | 4-6 Std |
| 4.2 | Security-Review | HOCH | 4-6 Std |
| 4.3 | Performance-Test | MITTEL | 2-3 Std |
| 4.4 | Mobile-Test | MITTEL | 2 Std |
| 4.5 | Cross-Browser-Test | NIEDRIG | 2 Std |

### Teil B: Soft Launch

| # | Aufgabe | Priorität | Geschätzt |
|---|---------|-----------|-----------|
| 4.6 | Beta-Kunden einladen (3-5) | HOCH | - |
| 4.7 | Feedback sammeln | HOCH | - |
| 4.8 | Bugs fixen | HOCH | variabel |
| 4.9 | Dokumentation finalisieren | MITTEL | 2-3 Std |

### Teil C: Go-Live

| # | Aufgabe | Priorität | Geschätzt |
|---|---------|-----------|-----------|
| 4.10 | Marketing-Website (Landing Page) | MITTEL | 4-8 Std |
| 4.11 | SEO-Grundlagen | NIEDRIG | 2 Std |
| 4.12 | Analytics einrichten | NIEDRIG | 1 Std |
| 4.13 | Support-Kanal (E-Mail) | HOCH | 1 Std |
| 4.14 | **GO LIVE** 🚀 | - | - |

---

## Zeitplan (Vorschlag)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  WOCHE    │ PHASE              │ FOKUS                                      │
├───────────┼────────────────────┼────────────────────────────────────────────┤
│  Woche 1  │ Phase 0 + 1        │ Vorbereitung, Setup, Rebranding            │
│  Woche 2  │ Phase 2 (Start)    │ Prisma Schema, RLS, Middleware             │
│  Woche 3  │ Phase 2 (Ende)     │ API-Routes, Tests                          │
│  Woche 4  │ Phase 3 (Billing)  │ Stripe, Checkout, Webhooks                 │
│  Woche 5  │ Phase 3 (Onboard)  │ Registrierung, Wizard, Trial               │
│  Woche 6  │ Phase 3 (Admin)    │ Admin-Panel, E-Mails                       │
│  Woche 7  │ Phase 4 (Test)     │ Testing, Beta-Kunden                       │
│  Woche 8  │ Phase 4 (Launch)   │ Bugfixes, Go-Live                          │
└───────────┴────────────────────┴────────────────────────────────────────────┘
```

**Hinweis:** Dies ist ein aggressiver Zeitplan für einen fokussierten Entwickler. Mit Puffer und realistischen Unterbrechungen: **10-12 Wochen**.

---

## Ressourcen-Übersicht

### Einmalige Kosten

| Posten | Kosten |
|--------|--------|
| Domain (belegflow.de, 1 Jahr) | ~10-15 € |
| Logo/Branding (optional, DIY möglich) | 0-500 € |
| Anwalt für AGB/Datenschutz (optional) | 500-1.500 € |

### Laufende Kosten

| Posten | Kosten/Monat |
|--------|--------------|
| Server (bestehender VPS reicht erstmal) | 0 € (bereits vorhanden) |
| Stripe (2,9% + 0,25€ pro Transaktion) | variabel |
| E-Mail-Service (z.B. Resend, Postmark) | 0-20 € |
| SSL-Zertifikat (Let's Encrypt) | 0 € |

**Total Startkosten:** ~10-2.000 € (je nach Anwalt/Branding)
**Laufende Kosten:** ~0-50 €/Monat (+ Stripe-Gebühren)

---

## Nächste Schritte (SOFORT)

### Diese Woche erledigen:

1. **[ ] Produktnamen entscheiden**
   - Domain-Verfügbarkeit prüfen
   - Finale Entscheidung treffen

2. **[ ] Domain registrieren**
   - Bei gewohntem Registrar

3. **[ ] Stripe-Account erstellen**
   - https://dashboard.stripe.com/register
   - Unternehmensdaten hinterlegen

4. **[ ] Preise bestätigen**
   - Starter: 19 €?
   - Business: 49 €?
   - Enterprise: 149 €?

5. **[ ] Cloud-Auftrag für Phase 1 starten**
   - Repository forken
   - Rebranding
   - Deployment

---

## Risiken & Mitigationen

| Risiko | Wahrscheinlichkeit | Mitigation |
|--------|-------------------|------------|
| Sicherheitslücke bei Tenant-Isolation | Mittel | RLS + Tests + Code-Review |
| Stripe-Integration komplex | Niedrig | Gute Dokumentation, Test-Modus |
| Zu wenig Beta-Tester | Mittel | Frühzeitig ansprechen |
| Rechtliche Probleme (AGB) | Niedrig | Vorlage von Anwalt |
| Performance bei vielen Tenants | Niedrig | Architektur ist skalierbar |

---

## Erfolgskriterien

### MVP (Minimum Viable Product)
- [ ] Kunde kann sich registrieren
- [ ] 14-Tage-Trial funktioniert
- [ ] Beleg-Upload + KI-Erkennung funktioniert
- [ ] DATEV-Export funktioniert
- [ ] Zahlung über Stripe möglich
- [ ] Mandanten sind vollständig getrennt

### Version 1.0
- [ ] 3+ zahlende Kunden
- [ ] Keine kritischen Bugs
- [ ] Positives Feedback von Beta-Testern
- [ ] < 5 Sekunden Ladezeit
- [ ] Uptime > 99%

---

*Letzte Aktualisierung: August 2026*
