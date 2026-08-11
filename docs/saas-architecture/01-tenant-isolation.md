# Tenant-Isolation – Technische Architektur

## 1. Übersicht

Dieses Dokument beschreibt die technische Umsetzung der Mandantentrennung (Multi-Tenancy) für die SaaS-Version der Belegverwaltung.

### Ziele
- **Strikte Datentrennung**: Kein Mandant kann Daten eines anderen sehen
- **Performance**: Keine spürbare Verlangsamung durch Mandantenfilter
- **Skalierbarkeit**: Architektur unterstützt Wachstum von 10 auf 10.000+ Mandanten
- **Compliance**: DSGVO-konforme Datenhaltung und -löschung

---

## 2. Architekturentscheidung: Shared Database mit Row-Level Security

### Gewählter Ansatz
```
┌─────────────────────────────────────────────────────────────┐
│                    PostgreSQL Datenbank                      │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐        │
│  │Tenant A │  │Tenant B │  │Tenant C │  │Tenant D │  ...   │
│  │tenant_id│  │tenant_id│  │tenant_id│  │tenant_id│        │
│  │= "abc"  │  │= "def"  │  │= "ghi"  │  │= "jkl"  │        │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘        │
│                                                              │
│  Row-Level Security (RLS) filtert automatisch               │
└─────────────────────────────────────────────────────────────┘
```

### Alternativen (abgelehnt)

| Ansatz | Vorteile | Nachteile | Entscheidung |
|--------|----------|-----------|--------------|
| **Database per Tenant** | Maximale Isolation | Hoher Verwaltungsaufwand, teuer | ❌ Nicht für MVP |
| **Schema per Tenant** | Gute Isolation | Migrations-Komplexität | ❌ Zu komplex |
| **Shared Database + App-Filter** | Einfach | Fehleranfällig | ❌ Zu riskant |
| **Shared Database + RLS** | Balance aus Sicherheit & Einfachheit | Etwas mehr Setup | ✅ Gewählt |

---

## 3. Datenbankschema

### 3.1 Tenant-Tabelle (Mandanten)

```sql
CREATE TABLE tenants (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug            VARCHAR(50) UNIQUE NOT NULL,  -- z.B. "musterfirma"
    name            VARCHAR(255) NOT NULL,         -- z.B. "Musterfirma GmbH"
    
    -- Kontaktdaten
    email           VARCHAR(255) NOT NULL,
    phone           VARCHAR(50),
    
    -- Adresse
    street          VARCHAR(255),
    zip             VARCHAR(20),
    city            VARCHAR(100),
    country_code    VARCHAR(2) DEFAULT 'DE',
    
    -- Verschlüsselung
    encryption_key_id   VARCHAR(255),              -- Referenz auf Key in KMS
    
    -- Status
    status          VARCHAR(20) DEFAULT 'active',  -- active, suspended, deleted
    suspended_at    TIMESTAMPTZ,
    suspended_reason TEXT,
    
    -- Subscription (Referenz)
    subscription_id UUID,
    
    -- Timestamps
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ                    -- Soft Delete
);

CREATE INDEX idx_tenants_slug ON tenants(slug);
CREATE INDEX idx_tenants_status ON tenants(status);
```

### 3.2 Erweiterte User-Tabelle

```sql
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Basis
    email           VARCHAR(255) NOT NULL,
    name            VARCHAR(255) NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,         -- Argon2id
    
    -- Rolle
    role            VARCHAR(20) NOT NULL,          -- superadmin, tenant_admin, member, reader
    
    -- 2FA
    totp_secret     VARCHAR(255),                  -- Verschlüsselt
    totp_enabled    BOOLEAN DEFAULT FALSE,
    backup_codes    TEXT[],                        -- Verschlüsselt, Array
    
    -- PIN (für Schnellzugriff)
    pin_hash        VARCHAR(255),
    
    -- Status
    active          BOOLEAN DEFAULT TRUE,
    email_verified  BOOLEAN DEFAULT FALSE,
    
    -- Timestamps
    last_login_at   TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(tenant_id, email)
);

CREATE INDEX idx_users_tenant ON users(tenant_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
```

### 3.3 Erweiterte Receipt-Tabelle (Beispiel)

```sql
CREATE TABLE receipts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id),
    
    -- Alle bestehenden Felder...
    date            DATE NOT NULL,
    supplier        VARCHAR(255),
    amount          DECIMAL(12,2) NOT NULL,
    currency        VARCHAR(3) DEFAULT 'EUR',
    -- ... etc.
    
    -- Timestamps
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ
);

-- Wichtig: Zusammengesetzter Index für Performance
CREATE INDEX idx_receipts_tenant_date ON receipts(tenant_id, date DESC);
CREATE INDEX idx_receipts_tenant_user ON receipts(tenant_id, user_id);
```

---

## 4. Row-Level Security (RLS)

### 4.1 Grundprinzip

```sql
-- 1. RLS aktivieren
ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipts FORCE ROW LEVEL SECURITY;

-- 2. Policy erstellen
CREATE POLICY tenant_isolation ON receipts
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
```

### 4.2 Session-Variable setzen (bei jedem Request)

```typescript
// middleware/tenant.ts
import { prisma } from '@/lib/prisma';

export async function setTenantContext(tenantId: string) {
  await prisma.$executeRawUnsafe(
    `SET LOCAL app.current_tenant_id = '${tenantId}'`
  );
}
```

### 4.3 Vollständige RLS-Policies

```sql
-- ============================================================
-- TENANTS (nur Superadmin sieht alle)
-- ============================================================
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_self_access ON tenants
    USING (
        id = current_setting('app.current_tenant_id', true)::UUID
        OR current_setting('app.is_superadmin', true)::BOOLEAN = true
    );

-- ============================================================
-- USERS
-- ============================================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_tenant_isolation ON users
    USING (
        tenant_id = current_setting('app.current_tenant_id', true)::UUID
        OR current_setting('app.is_superadmin', true)::BOOLEAN = true
        OR tenant_id IS NULL  -- Superadmins haben tenant_id = NULL
    );

-- ============================================================
-- RECEIPTS
-- ============================================================
ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;

CREATE POLICY receipt_tenant_isolation ON receipts
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

-- ============================================================
-- Alle weiteren Tabellen analog...
-- ============================================================
```

### 4.4 Bypass für Superadmin

```typescript
// Superadmin-Kontext
async function setSuperadminContext() {
  await prisma.$executeRaw`SET LOCAL app.is_superadmin = true`;
}

// Normaler Tenant-Kontext
async function setTenantContext(tenantId: string) {
  await prisma.$executeRaw`SET LOCAL app.is_superadmin = false`;
  await prisma.$executeRawUnsafe(
    `SET LOCAL app.current_tenant_id = '${tenantId}'`
  );
}
```

---

## 5. Application-Level Sicherheit (Defense in Depth)

### 5.1 Middleware-Stack

```typescript
// middleware/tenant-context.ts
import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

export async function tenantMiddleware(req: NextRequest) {
  const token = await getToken({ req });
  
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  // Tenant-ID aus JWT extrahieren
  const tenantId = token.tenantId as string;
  
  if (!tenantId && token.role !== 'superadmin') {
    return NextResponse.json({ error: 'No tenant context' }, { status: 403 });
  }
  
  // Header für nachfolgende Handler setzen
  const response = NextResponse.next();
  response.headers.set('X-Tenant-ID', tenantId || 'superadmin');
  
  return response;
}
```

### 5.2 Prisma Client Extension

```typescript
// lib/prisma-tenant.ts
import { PrismaClient } from '@prisma/client';

export function createTenantPrismaClient(tenantId: string) {
  const prisma = new PrismaClient();
  
  return prisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          // Automatisch tenant_id zu WHERE hinzufügen
          if (['findMany', 'findFirst', 'findUnique', 'update', 'delete'].includes(operation)) {
            args.where = {
              ...args.where,
              tenant_id: tenantId,
            };
          }
          
          // Automatisch tenant_id bei CREATE setzen
          if (operation === 'create') {
            args.data = {
              ...args.data,
              tenant_id: tenantId,
            };
          }
          
          return query(args);
        },
      },
    },
  });
}
```

### 5.3 API-Route-Handler

```typescript
// app/api/receipts/route.ts
import { requireAuth } from '@/lib/auth';
import { createTenantPrismaClient } from '@/lib/prisma-tenant';

export async function GET(req: Request) {
  const session = await requireAuth();
  
  // Tenant-spezifischer Prisma Client
  const prisma = createTenantPrismaClient(session.tenantId);
  
  // RLS-Kontext setzen (doppelte Sicherheit)
  await prisma.$executeRawUnsafe(
    `SET LOCAL app.current_tenant_id = '${session.tenantId}'`
  );
  
  // Abfrage - tenant_id wird automatisch gefiltert
  const receipts = await prisma.receipt.findMany({
    orderBy: { date: 'desc' },
  });
  
  return Response.json(receipts);
}
```

---

## 6. Subdomain-Routing

### 6.1 URL-Struktur

```
https://musterfirma.belegbox.de     → Tenant "musterfirma"
https://handwerk-mueller.belegbox.de → Tenant "handwerk-mueller"
https://app.belegbox.de             → Login/Tenant-Auswahl
https://admin.belegbox.de           → Superadmin-Panel
```

### 6.2 Middleware für Subdomain-Erkennung

```typescript
// middleware.ts
import { NextRequest, NextResponse } from 'next/server';

export function middleware(req: NextRequest) {
  const hostname = req.headers.get('host') || '';
  const subdomain = hostname.split('.')[0];
  
  // Reservierte Subdomains
  const reserved = ['www', 'app', 'admin', 'api', 'static'];
  
  if (reserved.includes(subdomain)) {
    return NextResponse.next();
  }
  
  // Tenant-Subdomain → Header setzen
  const response = NextResponse.next();
  response.headers.set('X-Tenant-Slug', subdomain);
  
  return response;
}
```

### 6.3 DNS-Konfiguration

```
*.belegbox.de.    300    IN    A       109.199.112.176
*.belegbox.de.    300    IN    AAAA    2a02:c207:3020:614::1
```

### 6.4 Nginx-Konfiguration

```nginx
server {
    listen 443 ssl http2;
    server_name ~^(?<subdomain>.+)\.belegbox\.de$;
    
    ssl_certificate /etc/letsencrypt/live/belegbox.de/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/belegbox.de/privkey.pem;
    
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Tenant-Slug $subdomain;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

---

## 7. Verschlüsselung pro Mandant

### 7.1 Schlüsselhierarchie

```
┌─────────────────────────────────────────────────────────────┐
│                    Master Key (KEK)                          │
│            (Umgebungsvariable / AWS KMS)                     │
└─────────────────────┬───────────────────────────────────────┘
                      │ verschlüsselt
          ┌───────────┼───────────┬───────────┐
          ▼           ▼           ▼           ▼
    ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐
    │Tenant A │ │Tenant B │ │Tenant C │ │Tenant D │
    │  DEK    │ │  DEK    │ │  DEK    │ │  DEK    │
    └─────────┘ └─────────┘ └─────────┘ └─────────┘
         │           │           │           │
         ▼           ▼           ▼           ▼
    Verschlüsselte Dokumente & sensible Daten
```

### 7.2 Schlüssel-Tabelle

```sql
CREATE TABLE tenant_encryption_keys (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    
    -- Der DEK, verschlüsselt mit dem Master Key
    encrypted_key   BYTEA NOT NULL,
    
    -- Metadaten
    algorithm       VARCHAR(50) DEFAULT 'AES-256-GCM',
    key_version     INTEGER DEFAULT 1,
    
    -- Rotation
    active          BOOLEAN DEFAULT TRUE,
    rotated_at      TIMESTAMPTZ,
    expires_at      TIMESTAMPTZ,
    
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tek_tenant_active ON tenant_encryption_keys(tenant_id, active);
```

### 7.3 Verschlüsselungs-Service

```typescript
// lib/encryption-service.ts
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const MASTER_KEY = Buffer.from(process.env.MASTER_ENCRYPTION_KEY!, 'hex');

export class TenantEncryption {
  private tenantKey: Buffer;
  
  constructor(encryptedKey: Buffer) {
    // DEK mit Master Key entschlüsseln
    this.tenantKey = this.decryptWithMasterKey(encryptedKey);
  }
  
  private decryptWithMasterKey(encrypted: Buffer): Buffer {
    const iv = encrypted.slice(0, 12);
    const tag = encrypted.slice(12, 28);
    const data = encrypted.slice(28);
    
    const decipher = createDecipheriv(ALGORITHM, MASTER_KEY, iv);
    decipher.setAuthTag(tag);
    
    return Buffer.concat([decipher.update(data), decipher.final()]);
  }
  
  encrypt(plaintext: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv(ALGORITHM, this.tenantKey, iv);
    
    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    
    const tag = cipher.getAuthTag();
    
    // Format: iv (12) + tag (16) + encrypted
    return Buffer.concat([iv, tag, encrypted]).toString('base64');
  }
  
  decrypt(ciphertext: string): string {
    const data = Buffer.from(ciphertext, 'base64');
    
    const iv = data.slice(0, 12);
    const tag = data.slice(12, 28);
    const encrypted = data.slice(28);
    
    const decipher = createDecipheriv(ALGORITHM, this.tenantKey, iv);
    decipher.setAuthTag(tag);
    
    return Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]).toString('utf8');
  }
}
```

---

## 8. Audit-Logging

### 8.1 Audit-Log-Tabelle

```sql
CREATE TABLE audit_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID REFERENCES tenants(id),  -- NULL für Superadmin-Aktionen
    user_id         UUID REFERENCES users(id),
    
    -- Was wurde getan
    action          VARCHAR(50) NOT NULL,         -- CREATE, UPDATE, DELETE, VIEW, LOGIN, etc.
    entity_type     VARCHAR(50) NOT NULL,         -- receipt, user, settings, etc.
    entity_id       UUID,
    
    -- Details
    old_values      JSONB,
    new_values      JSONB,
    
    -- Kontext
    ip_address      INET,
    user_agent      TEXT,
    request_id      UUID,
    
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Partitionierung nach Monat für Performance
CREATE INDEX idx_audit_tenant_time ON audit_logs(tenant_id, created_at DESC);
CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id);
```

### 8.2 Audit-Service

```typescript
// lib/audit.ts
import { prisma } from '@/lib/prisma';
import { headers } from 'next/headers';

interface AuditEntry {
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'VIEW' | 'LOGIN' | 'LOGOUT' | 'EXPORT';
  entityType: string;
  entityId?: string;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
}

export async function audit(
  tenantId: string | null,
  userId: string,
  entry: AuditEntry
) {
  const headersList = headers();
  
  await prisma.auditLog.create({
    data: {
      tenantId,
      userId,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      oldValues: entry.oldValues,
      newValues: entry.newValues,
      ipAddress: headersList.get('x-forwarded-for') || headersList.get('x-real-ip'),
      userAgent: headersList.get('user-agent'),
      requestId: headersList.get('x-request-id'),
    },
  });
}
```

---

## 9. Tenant-Lifecycle

### 9.1 Statusübergänge

```
                    ┌──────────┐
                    │ PENDING  │ (Registrierung)
                    └────┬─────┘
                         │ E-Mail verifiziert
                         ▼
                    ┌──────────┐
              ┌────▶│  ACTIVE  │◀────┐
              │     └────┬─────┘     │
              │          │           │
    Zahlung OK│          │ Zahlung   │ Reaktiviert
              │          │ fehlgeschl│
              │          ▼           │
              │     ┌──────────┐     │
              └─────│SUSPENDED │─────┘
                    └────┬─────┘
                         │ 30 Tage ohne Zahlung
                         ▼
                    ┌──────────┐
                    │ DELETED  │ (Soft Delete)
                    └────┬─────┘
                         │ 90 Tage
                         ▼
                    ┌──────────┐
                    │ PURGED   │ (Daten gelöscht)
                    └──────────┘
```

### 9.2 Löschkonzept (DSGVO)

```typescript
// jobs/tenant-cleanup.ts

// 1. Soft Delete: Tenant auf "deleted" setzen
async function softDeleteTenant(tenantId: string) {
  await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      status: 'deleted',
      deletedAt: new Date(),
    },
  });
  
  // Alle Sessions invalidieren
  await prisma.session.deleteMany({ where: { tenantId } });
}

// 2. Hard Delete: Nach 90 Tagen alle Daten löschen
async function purgeTenant(tenantId: string) {
  // Reihenfolge beachten (Foreign Keys)
  await prisma.$transaction([
    prisma.auditLog.deleteMany({ where: { tenantId } }),
    prisma.receiptFile.deleteMany({ where: { receipt: { tenantId } } }),
    prisma.receipt.deleteMany({ where: { tenantId } }),
    prisma.user.deleteMany({ where: { tenantId } }),
    prisma.tenantEncryptionKey.deleteMany({ where: { tenantId } }),
    prisma.tenant.delete({ where: { id: tenantId } }),
  ]);
  
  // Dateien aus Storage löschen
  await deleteStorageFolder(`tenants/${tenantId}`);
  
  // Audit (in System-Log, nicht Tenant-Log)
  await systemAudit('TENANT_PURGED', { tenantId });
}
```

---

## 10. Performance-Optimierung

### 10.1 Indizes

```sql
-- Composite-Indizes für häufige Queries
CREATE INDEX idx_receipts_tenant_date ON receipts(tenant_id, date DESC);
CREATE INDEX idx_receipts_tenant_status ON receipts(tenant_id, send_status);
CREATE INDEX idx_users_tenant_active ON users(tenant_id, active);

-- Partial Index für aktive Tenants
CREATE INDEX idx_tenants_active ON tenants(id) WHERE status = 'active';
```

### 10.2 Connection Pooling

```typescript
// lib/prisma.ts
import { PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma || new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
  // Connection Pool Einstellungen
  log: process.env.NODE_ENV === 'development' ? ['query'] : [],
});

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
```

### 10.3 Query-Monitoring

```sql
-- Langsame Queries finden
SELECT 
    query,
    calls,
    mean_time,
    total_time
FROM pg_stat_statements
WHERE query LIKE '%tenant_id%'
ORDER BY mean_time DESC
LIMIT 20;
```

---

## 11. Testing

### 11.1 Isolation-Tests

```typescript
// __tests__/tenant-isolation.test.ts
import { createTenantPrismaClient } from '@/lib/prisma-tenant';

describe('Tenant Isolation', () => {
  const tenantA = 'tenant-a-id';
  const tenantB = 'tenant-b-id';
  
  beforeAll(async () => {
    // Testdaten erstellen
    const prismaA = createTenantPrismaClient(tenantA);
    const prismaB = createTenantPrismaClient(tenantB);
    
    await prismaA.receipt.create({ data: { ... } });
    await prismaB.receipt.create({ data: { ... } });
  });
  
  it('Tenant A kann nur eigene Belege sehen', async () => {
    const prisma = createTenantPrismaClient(tenantA);
    const receipts = await prisma.receipt.findMany();
    
    expect(receipts.every(r => r.tenantId === tenantA)).toBe(true);
  });
  
  it('Tenant B kann Tenant A nicht sehen', async () => {
    const prisma = createTenantPrismaClient(tenantB);
    const receiptsFromA = await prisma.receipt.findMany({
      where: { tenantId: tenantA },
    });
    
    expect(receiptsFromA).toHaveLength(0);
  });
  
  it('RLS blockiert direkten Zugriff', async () => {
    const prisma = createTenantPrismaClient(tenantB);
    
    // Versuch, direkt auf Tenant A zuzugreifen
    const result = await prisma.$queryRaw`
      SELECT * FROM receipts WHERE tenant_id = ${tenantA}
    `;
    
    expect(result).toHaveLength(0); // RLS blockiert
  });
});
```

---

## 12. Checkliste für Implementierung

- [ ] Prisma Schema um `tenantId` erweitern
- [ ] Migration erstellen und testen
- [ ] RLS-Policies in PostgreSQL erstellen
- [ ] Tenant-Middleware implementieren
- [ ] Prisma Client Extension für Auto-Filter
- [ ] Subdomain-Routing konfigurieren
- [ ] Wildcard-SSL-Zertifikat einrichten
- [ ] Verschlüsselungs-Service implementieren
- [ ] Audit-Logging aktivieren
- [ ] Isolation-Tests schreiben
- [ ] Performance-Tests mit mehreren Tenants
- [ ] DSGVO-Löschkonzept implementieren
