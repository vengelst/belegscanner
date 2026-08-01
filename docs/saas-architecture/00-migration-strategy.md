# Migrations-Strategie: BelegScanner → BelegBox SaaS

## 1. Übersicht

Dieses Dokument beschreibt die Strategie, die bestehende Single-Tenant-App "BelegScanner" als Grundlage für eine neue Multi-Tenant SaaS-App "BelegBox" zu nutzen.

### Ausgangssituation
- **BelegScanner**: Produktive Single-Tenant-App unter `beleg.vivahome.de`
- **Aktive Nutzer**: Wird täglich verwendet
- **Ziel**: Neue Multi-Tenant SaaS-Version ohne Beeinträchtigung des laufenden Betriebs

### Strategie
```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                              │
│   BESTEHEND (läuft weiter)              NEU (parallel entwickeln)           │
│   ════════════════════════              ════════════════════════            │
│                                                                              │
│   ┌─────────────────────┐              ┌─────────────────────┐             │
│   │   BelegScanner      │              │     BelegBox        │             │
│   │   (Single-Tenant)   │    FORK      │   (Multi-Tenant)    │             │
│   │                     │ ──────────▶  │                     │             │
│   │ beleg.vivahome.de   │              │   app.belegbox.de   │             │
│   │                     │              │                     │             │
│   │ Repository:         │              │ Repository:         │             │
│   │ belegscanner        │              │ belegbox            │             │
│   └─────────────────────┘              └─────────────────────┘             │
│            │                                      │                         │
│            │                                      │                         │
│            ▼                                      ▼                         │
│   Weiterhin für                         Neue Entwicklung                    │
│   interne Nutzung                       Multi-Tenancy                       │
│                                         Billing                             │
│                                         Onboarding                          │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Repository-Strategie

### Option A: Fork (Empfohlen)
```bash
# 1. Neues Repository erstellen
gh repo create belegbox --private

# 2. BelegScanner klonen
git clone https://github.com/vengelst/belegscanner.git belegbox
cd belegbox

# 3. Remote ändern
git remote remove origin
git remote add origin https://github.com/vengelst/belegbox.git

# 4. Upstream für spätere Cherry-Picks behalten (optional)
git remote add upstream https://github.com/vengelst/belegscanner.git

# 5. Pushen
git push -u origin main
```

### Vorteile Fork:
- Vollständige Git-Historie erhalten
- Cherry-Pick von Bugfixes aus BelegScanner möglich
- Klare Trennung der Codebases

### Option B: Clean Copy (Alternative)
```bash
# Nur den aktuellen Stand kopieren, ohne Historie
cp -r belegscanner belegbox
cd belegbox
rm -rf .git
git init
git add .
git commit -m "Initial commit: Fork from BelegScanner"
```

### Vorteile Clean Copy:
- Saubere Historie
- Keine "Altlasten"
- Kleineres Repository

**Empfehlung: Option A (Fork)** - Die Historie ist wertvoll für Debugging und Verständnis.

---

## 3. Umbenennung und Rebranding

### 3.1 Zu ändernde Dateien

```
belegbox/
├── package.json              # name: "belegbox"
├── README.md                 # Neuer Name + Beschreibung
├── docker-compose.prod.yml   # Container-Namen
├── .env.example              # Neue URLs
│
├── src/
│   ├── app/
│   │   ├── layout.tsx        # <title>, Metadata
│   │   └── (auth)/
│   │       └── login/        # Branding, Logo
│   │
│   ├── components/
│   │   ├── logo.tsx          # Neues Logo
│   │   └── footer.tsx        # Copyright
│   │
│   └── lib/
│       └── constants.ts      # APP_NAME, URLs
│
├── public/
│   ├── favicon.ico           # Neues Icon
│   ├── logo.svg              # Neues Logo
│   └── og-image.png          # Social Preview
│
└── docs/                     # Aktualisierte Docs
```

### 3.2 Automatisiertes Rebranding

```bash
#!/bin/bash
# scripts/rebrand.sh

OLD_NAME="belegscanner"
NEW_NAME="belegbox"
OLD_DISPLAY="BelegScanner"
NEW_DISPLAY="BelegBox"

# package.json
sed -i "s/\"name\": \"$OLD_NAME\"/\"name\": \"$NEW_NAME\"/" package.json

# Alle Dateien durchsuchen und ersetzen
find . -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.md" -o -name "*.yml" -o -name "*.json" \) \
  -not -path "./node_modules/*" \
  -not -path "./.git/*" \
  -exec sed -i "s/$OLD_DISPLAY/$NEW_DISPLAY/g" {} \;

# Docker Container Namen
sed -i "s/$OLD_NAME/$NEW_NAME/g" docker-compose*.yml

echo "Rebranding abgeschlossen. Bitte manuell prüfen:"
echo "- Logo-Dateien ersetzen"
echo "- Favicon ersetzen"
echo "- README anpassen"
```

### 3.3 Konstanten zentralisieren

```typescript
// src/lib/constants.ts
export const APP_NAME = 'BelegBox';
export const APP_DESCRIPTION = 'Digitale Belegverwaltung für kleine Unternehmen';
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://app.belegbox.de';

export const COMPANY = {
  name: 'BelegBox GmbH', // oder Ihre Firma
  address: 'Musterstraße 1, 12345 Musterstadt',
  email: 'support@belegbox.de',
  phone: '+49 123 456789',
};

export const LEGAL = {
  imprintUrl: 'https://belegbox.de/impressum',
  privacyUrl: 'https://belegbox.de/datenschutz',
  termsUrl: 'https://belegbox.de/agb',
};
```

---

## 4. Datenbank-Migration

### 4.1 Schema-Erweiterung

Die bestehenden Tabellen müssen um `tenant_id` erweitert werden:

```sql
-- Migration: Add tenant support

-- 1. Tenants-Tabelle (neu)
CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- ... (siehe 01-tenant-isolation.md)
);

-- 2. Bestehende Tabellen erweitern
ALTER TABLE users ADD COLUMN tenant_id UUID REFERENCES tenants(id);
ALTER TABLE receipts ADD COLUMN tenant_id UUID REFERENCES tenants(id);
ALTER TABLE vehicles ADD COLUMN tenant_id UUID REFERENCES tenants(id);
ALTER TABLE purposes ADD COLUMN tenant_id UUID REFERENCES tenants(id);
ALTER TABLE categories ADD COLUMN tenant_id UUID REFERENCES tenants(id);
ALTER TABLE countries ADD COLUMN tenant_id UUID REFERENCES tenants(id);
ALTER TABLE datev_profiles ADD COLUMN tenant_id UUID REFERENCES tenants(id);
-- ... alle weiteren Tabellen

-- 3. Indizes hinzufügen
CREATE INDEX idx_users_tenant ON users(tenant_id);
CREATE INDEX idx_receipts_tenant ON receipts(tenant_id);
-- ... für alle Tabellen

-- 4. Neue Tabellen (Billing, Subscriptions, etc.)
-- ... (siehe andere Dokumente)
```

### 4.2 Prisma Schema Änderungen

```prisma
// prisma/schema.prisma

model Tenant {
  id              String   @id @default(cuid())
  slug            String   @unique
  name            String
  // ... weitere Felder
  
  // Relationen
  users           User[]
  receipts        Receipt[]
  vehicles        Vehicle[]
  purposes        Purpose[]
  categories      Category[]
  subscription    Subscription?
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}

model User {
  id              String   @id @default(cuid())
  tenantId        String?  // Optional für Superadmin
  tenant          Tenant?  @relation(fields: [tenantId], references: [id])
  
  // ... bestehende Felder
  
  @@index([tenantId])
}

model Receipt {
  id              String   @id @default(cuid())
  tenantId        String
  tenant          Tenant   @relation(fields: [tenantId], references: [id])
  
  // ... bestehende Felder
  
  @@index([tenantId])
  @@index([tenantId, date])
}

// ... alle weiteren Models analog
```

---

## 5. Code-Änderungen

### 5.1 Übersicht der Änderungen

| Bereich | Änderung | Aufwand |
|---------|----------|---------|
| **Auth** | Tenant-Kontext in Session | Mittel |
| **API-Routes** | Tenant-Filter in allen Queries | Hoch |
| **Middleware** | Tenant-Erkennung (Subdomain) | Mittel |
| **Prisma** | Client Extension für Auto-Filter | Mittel |
| **Components** | Tenant-spezifisches Branding (optional) | Niedrig |
| **Neue Features** | Billing, Onboarding, Admin-Panel | Hoch |

### 5.2 Auth-Erweiterung

```typescript
// src/auth.ts - Erweiterung
import NextAuth from 'next-auth';
import { PrismaAdapter } from '@auth/prisma-adapter';

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
        token.tenantId = user.tenantId;
        token.tenantSlug = user.tenant?.slug;
        token.role = user.role;
      }
      return token;
    },
    
    async session({ session, token }) {
      session.userId = token.userId;
      session.tenantId = token.tenantId;
      session.tenantSlug = token.tenantSlug;
      session.role = token.role;
      return session;
    },
  },
});

// Typen erweitern
declare module 'next-auth' {
  interface Session {
    userId: string;
    tenantId: string | null;
    tenantSlug: string | null;
    role: string;
  }
  
  interface User {
    tenantId: string | null;
    tenant?: { slug: string } | null;
    role: string;
  }
}
```

### 5.3 API-Routes anpassen

```typescript
// VORHER (Single-Tenant)
// src/app/api/receipts/route.ts

export async function GET() {
  const session = await requireAuth();
  
  const receipts = await prisma.receipt.findMany({
    where: { userId: session.userId },
    orderBy: { date: 'desc' },
  });
  
  return Response.json(receipts);
}

// ─────────────────────────────────────────────────────

// NACHHER (Multi-Tenant)
// src/app/api/receipts/route.ts

export async function GET() {
  const session = await requireAuth();
  
  // Tenant-Prisma-Client verwenden
  const tenantPrisma = createTenantPrismaClient(session.tenantId);
  
  const receipts = await tenantPrisma.receipt.findMany({
    where: { userId: session.userId },
    // tenant_id wird automatisch gefiltert
    orderBy: { date: 'desc' },
  });
  
  return Response.json(receipts);
}
```

### 5.4 Systematische Anpassung aller Routes

```bash
# Alle API-Routes finden
find src/app/api -name "route.ts" | wc -l

# Jede Route muss geprüft werden auf:
# 1. Verwendet prisma direkt? → Durch tenantPrisma ersetzen
# 2. Filtert nach userId? → Tenant-Filter hinzufügen
# 3. Erstellt Datensätze? → tenant_id setzen
```

---

## 6. Deployment-Strategie

### 6.1 Separate Deployments

```
PRODUKTION (BelegScanner - unverändert)
─────────────────────────────────────────
Server: vivahome.de
Domain: beleg.vivahome.de
Repo:   vengelst/belegscanner
DB:     belegscanner_db (Port 55433)
App:    Port 3003

ENTWICKLUNG/STAGING (BelegBox - neu)
─────────────────────────────────────────
Server: vivahome.de (oder neu)
Domain: app.belegbox.de
Repo:   vengelst/belegbox
DB:     belegbox_db (Port 55434)
App:    Port 3004
```

### 6.2 Docker-Compose für BelegBox

```yaml
# docker-compose.prod.yml (BelegBox)
services:
  db:
    image: postgres:16-alpine
    container_name: belegbox-db
    ports:
      - "127.0.0.1:55434:5432"
    volumes:
      - belegbox_postgres_data:/var/lib/postgresql/data
    environment:
      POSTGRES_DB: belegbox
      POSTGRES_USER: belegbox
      POSTGRES_PASSWORD: ${DB_PASSWORD}

  app:
    build: .
    container_name: belegbox-app
    ports:
      - "127.0.0.1:3004:3000"
    depends_on:
      - db
    environment:
      DATABASE_URL: postgresql://belegbox:${DB_PASSWORD}@db:5432/belegbox
      # ... weitere Umgebungsvariablen

volumes:
  belegbox_postgres_data:
```

### 6.3 Nginx-Konfiguration

```nginx
# /etc/nginx/sites-available/belegbox.de

# Wildcard für Tenant-Subdomains
server {
    listen 443 ssl http2;
    server_name ~^(?<subdomain>.+)\.belegbox\.de$;
    
    ssl_certificate /etc/letsencrypt/live/belegbox.de/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/belegbox.de/privkey.pem;
    
    location / {
        proxy_pass http://127.0.0.1:3004;
        proxy_set_header Host $host;
        proxy_set_header X-Tenant-Slug $subdomain;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# Hauptdomain (Marketing-Website oder Redirect)
server {
    listen 443 ssl http2;
    server_name belegbox.de www.belegbox.de;
    
    ssl_certificate /etc/letsencrypt/live/belegbox.de/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/belegbox.de/privkey.pem;
    
    # Option A: Redirect zu app
    return 301 https://app.belegbox.de$request_uri;
    
    # Option B: Marketing-Website
    # root /var/www/belegbox-website;
}
```

---

## 7. Entwicklungs-Roadmap

### Phase 1: Setup (1-2 Tage)
- [ ] Repository forken/kopieren
- [ ] Rebranding durchführen
- [ ] Neues Deployment aufsetzen
- [ ] Basis-Tests

### Phase 2: Multi-Tenancy (1-2 Wochen)
- [ ] Datenbank-Schema erweitern
- [ ] RLS implementieren
- [ ] Prisma Client Extension
- [ ] Alle API-Routes anpassen
- [ ] Auth erweitern
- [ ] Subdomain-Routing

### Phase 3: Billing (1-2 Wochen)
- [ ] Stripe-Integration
- [ ] Tarife anlegen
- [ ] Checkout-Flow
- [ ] Webhook-Handler
- [ ] Usage-Tracking
- [ ] Customer Portal

### Phase 4: Onboarding (1 Woche)
- [ ] Registrierung
- [ ] E-Mail-Verifizierung
- [ ] Setup-Wizard
- [ ] Trial-System
- [ ] Team-Einladung

### Phase 5: Admin-Panel (1 Woche)
- [ ] Superadmin-Dashboard
- [ ] Tenant-Verwaltung
- [ ] Billing-Übersicht
- [ ] System-Monitoring

### Phase 6: Testing & Launch (1-2 Wochen)
- [ ] End-to-End Tests
- [ ] Security Audit
- [ ] Performance Tests
- [ ] Beta-Kunden
- [ ] Go-Live

---

## 8. Bestehende Daten migrieren (Optional)

Falls die bestehenden BelegScanner-Daten in BelegBox übernommen werden sollen:

```typescript
// scripts/migrate-to-multitenant.ts

async function migrateExistingData() {
  // 1. Tenant für bestehende Daten erstellen
  const tenant = await prisma.tenant.create({
    data: {
      slug: 'vivahome',
      name: 'Vivahome',
      email: 've@vivahome.de',
      status: 'active',
    },
  });
  
  // 2. Alle bestehenden Datensätze dem Tenant zuordnen
  await prisma.$transaction([
    prisma.user.updateMany({
      where: { tenantId: null },
      data: { tenantId: tenant.id },
    }),
    prisma.receipt.updateMany({
      where: { tenantId: null },
      data: { tenantId: tenant.id },
    }),
    // ... alle weiteren Tabellen
  ]);
  
  // 3. Subscription erstellen (kostenlos oder spezieller Plan)
  await prisma.subscription.create({
    data: {
      tenantId: tenant.id,
      status: 'active',
      // Kein Stripe - interner Nutzer
    },
  });
  
  console.log('Migration abgeschlossen');
}
```

---

## 9. Checkliste

### Vor dem Start
- [ ] Domain `belegbox.de` registriert
- [ ] Stripe-Account erstellt
- [ ] SSL-Wildcard-Zertifikat organisiert
- [ ] E-Mail-Provider für Transaktions-E-Mails

### Repository
- [ ] Neues Repository erstellt
- [ ] Code kopiert/geforkt
- [ ] Rebranding durchgeführt
- [ ] CI/CD konfiguriert

### Infrastruktur
- [ ] Neuer Docker-Stack aufgesetzt
- [ ] Nginx konfiguriert
- [ ] DNS eingerichtet
- [ ] SSL-Zertifikate

### Entwicklung
- [ ] Multi-Tenancy implementiert
- [ ] Billing implementiert
- [ ] Onboarding implementiert
- [ ] Tests geschrieben

### Launch
- [ ] Security-Review
- [ ] Performance-Test
- [ ] Rechtliche Dokumente (AGB, Datenschutz, Impressum)
- [ ] Support-Kanäle eingerichtet
