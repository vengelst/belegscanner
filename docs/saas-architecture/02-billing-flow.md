# Billing-Flow – End-to-End Architektur

## 1. Übersicht

Dieses Dokument beschreibt den kompletten Abrechnungsfluss für die SaaS-Belegverwaltung, von der Tarifauswahl bis zur Rechnungsstellung.

### Ziele
- **Einfachheit**: Klare Tarifstruktur, keine versteckten Kosten
- **Flexibilität**: Upgrade/Downgrade jederzeit möglich
- **Automatisierung**: Monatliche Abrechnung ohne manuellen Aufwand
- **Transparenz**: Kunde sieht jederzeit Verbrauch und Kosten

---

## 2. Payment-Provider: Stripe

### Warum Stripe?
| Kriterium | Stripe | Mollie | PayPal |
|-----------|--------|--------|--------|
| Subscriptions | ✅ Nativ | ✅ | ⚠️ Umständlich |
| SEPA-Lastschrift | ✅ | ✅ | ❌ |
| Kreditkarte | ✅ | ✅ | ✅ |
| Usage-based Billing | ✅ | ❌ | ❌ |
| Webhooks | ✅ Exzellent | ✅ | ⚠️ |
| Deutschland/EU | ✅ | ✅ | ✅ |
| API-Qualität | ✅ Exzellent | ✅ Gut | ⚠️ |

**Entscheidung: Stripe** (beste API, native Subscriptions, Usage-based möglich)

---

## 3. Tarifstruktur

### 3.1 Tarife

| Tarif | Starter | Business | Enterprise |
|-------|---------|----------|------------|
| **Preis/Monat** | 19 € | 49 € | 149 € |
| **Benutzer** | 1 | 5 | Unbegrenzt |
| **Belege/Monat** | 100 | 500 | Unbegrenzt |
| **Speicher** | 1 GB | 10 GB | 100 GB |
| **KI-Analysen** | 50 | 250 | 1.000 |
| **Support** | E-Mail | E-Mail + Chat | Priorität |
| **DATEV-Export** | ✅ | ✅ | ✅ |
| **API-Zugang** | ❌ | ✅ | ✅ |
| **SSO/SAML** | ❌ | ❌ | ✅ |

### 3.2 Zusatzpakete (Add-ons)

| Add-on | Preis |
|--------|-------|
| Zusätzlicher Benutzer | 9 €/Monat |
| 100 zusätzliche Belege | 5 €/Monat |
| 10 GB zusätzlicher Speicher | 5 €/Monat |
| 100 zusätzliche KI-Analysen | 10 €/Monat |

### 3.3 Datenbank-Schema für Tarife

```sql
CREATE TABLE plans (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Identifikation
    slug            VARCHAR(50) UNIQUE NOT NULL,   -- starter, business, enterprise
    name            VARCHAR(100) NOT NULL,
    description     TEXT,
    
    -- Stripe
    stripe_price_id VARCHAR(100) NOT NULL,         -- price_xxx
    
    -- Limits
    max_users       INTEGER,                        -- NULL = unbegrenzt
    max_receipts_per_month INTEGER,
    max_storage_bytes BIGINT,
    max_ai_calls_per_month INTEGER,
    
    -- Features (JSONB für Flexibilität)
    features        JSONB DEFAULT '{}',
    -- Beispiel: {"api_access": true, "sso": false, "priority_support": false}
    
    -- Preisgestaltung
    price_monthly_cents INTEGER NOT NULL,          -- in Cent
    price_yearly_cents INTEGER,                    -- Rabatt bei jährlich
    currency        VARCHAR(3) DEFAULT 'EUR',
    
    -- Status
    active          BOOLEAN DEFAULT TRUE,
    visible         BOOLEAN DEFAULT TRUE,          -- In Preisliste anzeigen
    
    -- Sortierung
    sort_order      INTEGER DEFAULT 0,
    
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Add-ons
CREATE TABLE plan_addons (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    slug            VARCHAR(50) UNIQUE NOT NULL,
    name            VARCHAR(100) NOT NULL,
    description     TEXT,
    
    stripe_price_id VARCHAR(100) NOT NULL,
    
    -- Was gibt das Add-on?
    addon_type      VARCHAR(50) NOT NULL,          -- users, receipts, storage, ai_calls
    addon_quantity  INTEGER NOT NULL,              -- z.B. 1 User, 100 Belege
    
    price_monthly_cents INTEGER NOT NULL,
    currency        VARCHAR(3) DEFAULT 'EUR',
    
    active          BOOLEAN DEFAULT TRUE,
    
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 4. Subscription-Management

### 4.1 Subscription-Tabelle

```sql
CREATE TABLE subscriptions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    
    -- Stripe
    stripe_customer_id      VARCHAR(100) NOT NULL,
    stripe_subscription_id  VARCHAR(100),
    
    -- Aktueller Plan
    plan_id         UUID REFERENCES plans(id),
    
    -- Status
    status          VARCHAR(20) NOT NULL,
    -- active, trialing, past_due, canceled, unpaid, paused
    
    -- Zeiträume
    trial_ends_at           TIMESTAMPTZ,
    current_period_start    TIMESTAMPTZ,
    current_period_end      TIMESTAMPTZ,
    canceled_at             TIMESTAMPTZ,
    cancel_at_period_end    BOOLEAN DEFAULT FALSE,
    
    -- Zahlungsmethode
    payment_method_type     VARCHAR(20),           -- card, sepa_debit
    payment_method_last4    VARCHAR(4),
    payment_method_brand    VARCHAR(20),           -- visa, mastercard, etc.
    
    -- Add-ons (aktive)
    addons          JSONB DEFAULT '[]',
    -- Beispiel: [{"addon_id": "xxx", "quantity": 2, "stripe_item_id": "si_xxx"}]
    
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_subscriptions_tenant ON subscriptions(tenant_id);
CREATE INDEX idx_subscriptions_stripe ON subscriptions(stripe_subscription_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
```

### 4.2 Rechnungen

```sql
CREATE TABLE invoices (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    subscription_id UUID REFERENCES subscriptions(id),
    
    -- Stripe
    stripe_invoice_id   VARCHAR(100) UNIQUE,
    stripe_payment_intent_id VARCHAR(100),
    
    -- Rechnungsdaten
    invoice_number      VARCHAR(50) UNIQUE,        -- INV-2026-00001
    
    -- Beträge (in Cent)
    subtotal_cents      INTEGER NOT NULL,
    tax_cents           INTEGER DEFAULT 0,
    total_cents         INTEGER NOT NULL,
    currency            VARCHAR(3) DEFAULT 'EUR',
    
    -- Periode
    period_start        TIMESTAMPTZ,
    period_end          TIMESTAMPTZ,
    
    -- Status
    status              VARCHAR(20) NOT NULL,
    -- draft, open, paid, void, uncollectible
    
    paid_at             TIMESTAMPTZ,
    
    -- PDF
    pdf_url             TEXT,
    hosted_invoice_url  TEXT,
    
    -- Positionen
    line_items          JSONB,
    
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_invoices_tenant ON invoices(tenant_id);
CREATE INDEX idx_invoices_status ON invoices(status);
```

---

## 5. Billing-Flows

### 5.1 Neukunde: Trial → Subscription

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│ Registrierung│───▶│  14-Tage    │───▶│  Zahlung    │───▶│   Active    │
│             │    │   Trial     │    │  eingeben   │    │ Subscription│
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
                          │                                      │
                          │ Trial endet                          │
                          │ ohne Zahlung                         │
                          ▼                                      ▼
                   ┌─────────────┐                        Monatliche
                   │  Suspended  │                        Abrechnung
                   └─────────────┘
```

### 5.2 Sequenzdiagramm: Checkout

```
┌──────┐          ┌──────────┐          ┌────────┐          ┌────────┐
│Client│          │  Server  │          │ Stripe │          │Database│
└──┬───┘          └────┬─────┘          └───┬────┘          └───┬────┘
   │                   │                    │                   │
   │ POST /checkout    │                    │                   │
   │ {planId}          │                    │                   │
   │──────────────────▶│                    │                   │
   │                   │                    │                   │
   │                   │ Create Customer    │                   │
   │                   │───────────────────▶│                   │
   │                   │                    │                   │
   │                   │ Create Checkout    │                   │
   │                   │ Session            │                   │
   │                   │───────────────────▶│                   │
   │                   │                    │                   │
   │                   │ session_url        │                   │
   │                   │◀───────────────────│                   │
   │                   │                    │                   │
   │ Redirect to       │                    │                   │
   │ Stripe Checkout   │                    │                   │
   │◀──────────────────│                    │                   │
   │                   │                    │                   │
   │ ════════════════════════════════════════════════════════  │
   │           Kunde gibt Zahlungsdaten ein bei Stripe         │
   │ ════════════════════════════════════════════════════════  │
   │                   │                    │                   │
   │                   │    Webhook:        │                   │
   │                   │ checkout.completed │                   │
   │                   │◀───────────────────│                   │
   │                   │                    │                   │
   │                   │                    │ Save Subscription │
   │                   │                    │──────────────────▶│
   │                   │                    │                   │
   │                   │    Webhook:        │                   │
   │                   │ subscription.created                   │
   │                   │◀───────────────────│                   │
   │                   │                    │                   │
   │ Redirect to       │                    │                   │
   │ Success Page      │                    │                   │
   │◀──────────────────│                    │                   │
   │                   │                    │                   │
```

### 5.3 API-Implementierung: Checkout

```typescript
// app/api/billing/checkout/route.ts
import Stripe from 'stripe';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: Request) {
  const session = await requireAuth();
  const { planId } = await req.json();
  
  // Plan laden
  const plan = await prisma.plan.findUnique({
    where: { id: planId },
  });
  
  if (!plan) {
    return Response.json({ error: 'Plan not found' }, { status: 404 });
  }
  
  // Tenant laden
  const tenant = await prisma.tenant.findUnique({
    where: { id: session.tenantId },
    include: { subscription: true },
  });
  
  // Stripe Customer erstellen oder laden
  let stripeCustomerId = tenant?.subscription?.stripeCustomerId;
  
  if (!stripeCustomerId) {
    const customer = await stripe.customers.create({
      email: session.email,
      name: tenant!.name,
      metadata: {
        tenant_id: session.tenantId,
      },
    });
    stripeCustomerId = customer.id;
  }
  
  // Checkout Session erstellen
  const checkoutSession = await stripe.checkout.sessions.create({
    customer: stripeCustomerId,
    mode: 'subscription',
    payment_method_types: ['card', 'sepa_debit'],
    line_items: [
      {
        price: plan.stripePriceId,
        quantity: 1,
      },
    ],
    subscription_data: {
      trial_period_days: tenant?.subscription ? undefined : 14,
      metadata: {
        tenant_id: session.tenantId,
        plan_id: planId,
      },
    },
    success_url: `${process.env.APP_URL}/settings/billing?success=true`,
    cancel_url: `${process.env.APP_URL}/settings/billing?canceled=true`,
    metadata: {
      tenant_id: session.tenantId,
    },
  });
  
  return Response.json({ url: checkoutSession.url });
}
```

### 5.4 Webhook-Handler

```typescript
// app/api/webhooks/stripe/route.ts
import Stripe from 'stripe';
import { prisma } from '@/lib/prisma';
import { headers } from 'next/headers';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: Request) {
  const body = await req.text();
  const signature = headers().get('stripe-signature')!;
  
  let event: Stripe.Event;
  
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error('Webhook signature verification failed');
    return Response.json({ error: 'Invalid signature' }, { status: 400 });
  }
  
  switch (event.type) {
    case 'checkout.session.completed':
      await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
      break;
      
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
      await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
      break;
      
    case 'customer.subscription.deleted':
      await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
      break;
      
    case 'invoice.paid':
      await handleInvoicePaid(event.data.object as Stripe.Invoice);
      break;
      
    case 'invoice.payment_failed':
      await handlePaymentFailed(event.data.object as Stripe.Invoice);
      break;
      
    default:
      console.log(`Unhandled event type: ${event.type}`);
  }
  
  return Response.json({ received: true });
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const tenantId = session.metadata?.tenant_id;
  
  if (!tenantId) return;
  
  // Subscription wird über separaten Webhook erstellt
  // Hier nur Customer ID speichern falls noch nicht vorhanden
  await prisma.subscription.upsert({
    where: { tenantId },
    create: {
      tenantId,
      stripeCustomerId: session.customer as string,
      status: 'active',
    },
    update: {
      stripeCustomerId: session.customer as string,
    },
  });
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const tenantId = subscription.metadata?.tenant_id;
  
  if (!tenantId) return;
  
  // Plan aus Stripe laden
  const priceId = subscription.items.data[0]?.price.id;
  const plan = await prisma.plan.findFirst({
    where: { stripePriceId: priceId },
  });
  
  await prisma.subscription.update({
    where: { tenantId },
    data: {
      stripeSubscriptionId: subscription.id,
      planId: plan?.id,
      status: mapStripeStatus(subscription.status),
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      trialEndsAt: subscription.trial_end 
        ? new Date(subscription.trial_end * 1000) 
        : null,
    },
  });
  
  // Tenant-Status aktualisieren
  await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      status: subscription.status === 'active' ? 'active' : 'suspended',
    },
  });
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const tenantId = subscription.metadata?.tenant_id;
  
  if (!tenantId) return;
  
  await prisma.subscription.update({
    where: { tenantId },
    data: {
      status: 'canceled',
      canceledAt: new Date(),
    },
  });
  
  // Tenant suspendieren
  await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      status: 'suspended',
      suspendedAt: new Date(),
      suspendedReason: 'Subscription canceled',
    },
  });
}

async function handleInvoicePaid(invoice: Stripe.Invoice) {
  const tenantId = invoice.subscription_details?.metadata?.tenant_id;
  
  if (!tenantId) return;
  
  // Rechnung speichern
  await prisma.invoice.create({
    data: {
      tenantId,
      stripeInvoiceId: invoice.id,
      stripePaymentIntentId: invoice.payment_intent as string,
      invoiceNumber: invoice.number,
      subtotalCents: invoice.subtotal,
      taxCents: invoice.tax || 0,
      totalCents: invoice.total,
      currency: invoice.currency.toUpperCase(),
      periodStart: new Date(invoice.period_start * 1000),
      periodEnd: new Date(invoice.period_end * 1000),
      status: 'paid',
      paidAt: new Date(),
      pdfUrl: invoice.invoice_pdf,
      hostedInvoiceUrl: invoice.hosted_invoice_url,
      lineItems: invoice.lines.data.map(line => ({
        description: line.description,
        amount: line.amount,
        quantity: line.quantity,
      })),
    },
  });
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const tenantId = invoice.subscription_details?.metadata?.tenant_id;
  
  if (!tenantId) return;
  
  // E-Mail an Tenant senden
  await sendPaymentFailedEmail(tenantId, invoice);
  
  // Nach 3 fehlgeschlagenen Versuchen suspendieren
  // (Stripe macht das automatisch nach Konfiguration)
}

function mapStripeStatus(status: Stripe.Subscription.Status): string {
  const mapping: Record<string, string> = {
    'active': 'active',
    'trialing': 'trialing',
    'past_due': 'past_due',
    'canceled': 'canceled',
    'unpaid': 'unpaid',
    'incomplete': 'incomplete',
    'incomplete_expired': 'canceled',
    'paused': 'paused',
  };
  return mapping[status] || status;
}
```

---

## 6. Usage Tracking

### 6.1 Verbrauchszähler

```sql
CREATE TABLE usage_records (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    
    -- Periode
    period_start    DATE NOT NULL,
    period_end      DATE NOT NULL,
    
    -- Zähler
    receipts_count      INTEGER DEFAULT 0,
    ai_calls_count      INTEGER DEFAULT 0,
    storage_bytes       BIGINT DEFAULT 0,
    users_count         INTEGER DEFAULT 0,
    
    -- Limits (vom Plan zum Zeitpunkt der Erstellung)
    receipts_limit      INTEGER,
    ai_calls_limit      INTEGER,
    storage_limit       BIGINT,
    users_limit         INTEGER,
    
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(tenant_id, period_start)
);

CREATE INDEX idx_usage_tenant_period ON usage_records(tenant_id, period_start DESC);
```

### 6.2 Usage-Service

```typescript
// lib/usage-service.ts
import { prisma } from '@/lib/prisma';
import { startOfMonth, endOfMonth } from 'date-fns';

export class UsageService {
  private tenantId: string;
  
  constructor(tenantId: string) {
    this.tenantId = tenantId;
  }
  
  async getCurrentUsage() {
    const now = new Date();
    const periodStart = startOfMonth(now);
    const periodEnd = endOfMonth(now);
    
    // Oder erstellen falls nicht vorhanden
    const usage = await prisma.usageRecord.upsert({
      where: {
        tenantId_periodStart: {
          tenantId: this.tenantId,
          periodStart,
        },
      },
      create: {
        tenantId: this.tenantId,
        periodStart,
        periodEnd,
      },
      update: {},
    });
    
    return usage;
  }
  
  async incrementReceipts(count: number = 1) {
    const periodStart = startOfMonth(new Date());
    
    await prisma.usageRecord.update({
      where: {
        tenantId_periodStart: {
          tenantId: this.tenantId,
          periodStart,
        },
      },
      data: {
        receiptsCount: { increment: count },
      },
    });
  }
  
  async incrementAiCalls(count: number = 1) {
    const periodStart = startOfMonth(new Date());
    
    await prisma.usageRecord.update({
      where: {
        tenantId_periodStart: {
          tenantId: this.tenantId,
          periodStart,
        },
      },
      data: {
        aiCallsCount: { increment: count },
      },
    });
  }
  
  async checkLimit(type: 'receipts' | 'ai_calls' | 'storage' | 'users'): Promise<{
    allowed: boolean;
    current: number;
    limit: number | null;
    percentage: number;
  }> {
    const usage = await this.getCurrentUsage();
    const subscription = await prisma.subscription.findUnique({
      where: { tenantId: this.tenantId },
      include: { plan: true },
    });
    
    if (!subscription?.plan) {
      return { allowed: false, current: 0, limit: 0, percentage: 100 };
    }
    
    const plan = subscription.plan;
    
    const limits: Record<string, { current: number; limit: number | null }> = {
      receipts: { current: usage.receiptsCount, limit: plan.maxReceiptsPerMonth },
      ai_calls: { current: usage.aiCallsCount, limit: plan.maxAiCallsPerMonth },
      storage: { current: Number(usage.storageBytes), limit: Number(plan.maxStorageBytes) },
      users: { current: usage.usersCount, limit: plan.maxUsers },
    };
    
    const { current, limit } = limits[type];
    const percentage = limit ? (current / limit) * 100 : 0;
    
    return {
      allowed: limit === null || current < limit,
      current,
      limit,
      percentage,
    };
  }
}
```

### 6.3 Limit-Middleware

```typescript
// middleware/usage-limits.ts
import { UsageService } from '@/lib/usage-service';

export async function checkReceiptLimit(tenantId: string): Promise<void> {
  const usage = new UsageService(tenantId);
  const check = await usage.checkLimit('receipts');
  
  if (!check.allowed) {
    throw new LimitExceededError(
      'Monatliches Beleglimit erreicht',
      'receipts',
      check.current,
      check.limit!
    );
  }
  
  // Warnung bei 80%
  if (check.percentage >= 80) {
    await sendLimitWarningEmail(tenantId, 'receipts', check.percentage);
  }
}

export class LimitExceededError extends Error {
  type: string;
  current: number;
  limit: number;
  
  constructor(message: string, type: string, current: number, limit: number) {
    super(message);
    this.name = 'LimitExceededError';
    this.type = type;
    this.current = current;
    this.limit = limit;
  }
}
```

---

## 7. Upgrade/Downgrade

### 7.1 Plan-Wechsel-Logik

```typescript
// app/api/billing/change-plan/route.ts
import Stripe from 'stripe';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: Request) {
  const session = await requireAuth();
  const { newPlanId, immediate = false } = await req.json();
  
  const subscription = await prisma.subscription.findUnique({
    where: { tenantId: session.tenantId },
    include: { plan: true },
  });
  
  if (!subscription?.stripeSubscriptionId) {
    return Response.json({ error: 'No active subscription' }, { status: 400 });
  }
  
  const newPlan = await prisma.plan.findUnique({
    where: { id: newPlanId },
  });
  
  if (!newPlan) {
    return Response.json({ error: 'Plan not found' }, { status: 404 });
  }
  
  // Stripe Subscription aktualisieren
  const stripeSubscription = await stripe.subscriptions.retrieve(
    subscription.stripeSubscriptionId
  );
  
  const updatedSubscription = await stripe.subscriptions.update(
    subscription.stripeSubscriptionId,
    {
      items: [
        {
          id: stripeSubscription.items.data[0].id,
          price: newPlan.stripePriceId,
        },
      ],
      // Bei Upgrade: sofort abrechnen
      // Bei Downgrade: am Ende der Periode
      proration_behavior: immediate ? 'create_prorations' : 'none',
      billing_cycle_anchor: immediate ? 'now' : 'unchanged',
    }
  );
  
  // Lokale DB wird über Webhook aktualisiert
  
  return Response.json({
    success: true,
    effectiveDate: immediate 
      ? new Date() 
      : new Date(updatedSubscription.current_period_end * 1000),
  });
}
```

### 7.2 Proration (Anteilige Berechnung)

```
Beispiel: Upgrade von Starter (19€) zu Business (49€) am 15. des Monats

Restliche Tage im Monat: 15
Tage im Monat: 30

Gutschrift für Starter:  19€ × (15/30) = 9,50€
Kosten für Business:     49€ × (15/30) = 24,50€
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Sofort zu zahlen:                        15,00€
```

---

## 8. Zahlungsausfall-Handling

### 8.1 Dunning-Flow (Mahnwesen)

```
Tag 0:   Zahlung fehlgeschlagen
         → E-Mail: "Zahlung fehlgeschlagen"
         → Status: past_due
         
Tag 3:   Stripe versucht erneut
         → Falls erfolgreich: Status → active
         → Falls fehlgeschlagen: E-Mail "Zweiter Versuch fehlgeschlagen"
         
Tag 7:   Stripe versucht erneut
         → Falls erfolgreich: Status → active
         → Falls fehlgeschlagen: E-Mail "Letzter Versuch"
         
Tag 14:  Stripe versucht letztmalig
         → Falls erfolgreich: Status → active
         → Falls fehlgeschlagen:
           - Status: unpaid
           - Tenant: suspended
           - E-Mail: "Konto gesperrt"
           - Funktionen eingeschränkt (nur Lesen)
           
Tag 30:  Subscription wird von Stripe beendet
         → Status: canceled
         → E-Mail: "Abonnement beendet"
         
Tag 90:  Daten werden gelöscht (DSGVO)
         → Vorherige Warnung am Tag 60
```

### 8.2 Graceful Degradation

```typescript
// lib/access-control.ts
export function getTenantCapabilities(status: string) {
  switch (status) {
    case 'active':
    case 'trialing':
      return {
        canCreateReceipts: true,
        canExportData: true,
        canInviteUsers: true,
        canUseAi: true,
        canAccessApi: true,
      };
      
    case 'past_due':
      return {
        canCreateReceipts: true,  // Noch erlaubt
        canExportData: true,
        canInviteUsers: false,    // Eingeschränkt
        canUseAi: true,
        canAccessApi: true,
      };
      
    case 'unpaid':
    case 'suspended':
      return {
        canCreateReceipts: false, // Nur Lesen
        canExportData: true,      // Daten exportieren erlaubt
        canInviteUsers: false,
        canUseAi: false,
        canAccessApi: false,
      };
      
    case 'canceled':
      return {
        canCreateReceipts: false,
        canExportData: true,      // 30 Tage Export möglich
        canInviteUsers: false,
        canUseAi: false,
        canAccessApi: false,
      };
      
    default:
      return {
        canCreateReceipts: false,
        canExportData: false,
        canInviteUsers: false,
        canUseAi: false,
        canAccessApi: false,
      };
  }
}
```

---

## 9. Kundenportal

### 9.1 Stripe Customer Portal

```typescript
// app/api/billing/portal/route.ts
import Stripe from 'stripe';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: Request) {
  const session = await requireAuth();
  
  const subscription = await prisma.subscription.findUnique({
    where: { tenantId: session.tenantId },
  });
  
  if (!subscription?.stripeCustomerId) {
    return Response.json({ error: 'No customer found' }, { status: 400 });
  }
  
  // Stripe Customer Portal Session erstellen
  const portalSession = await stripe.billingPortal.sessions.create({
    customer: subscription.stripeCustomerId,
    return_url: `${process.env.APP_URL}/settings/billing`,
  });
  
  return Response.json({ url: portalSession.url });
}
```

### 9.2 Portal-Konfiguration (Stripe Dashboard)

```
Erlaubte Aktionen:
✅ Zahlungsmethode ändern
✅ Rechnungen herunterladen
✅ Rechnungsadresse ändern
✅ Plan ändern (mit Einschränkungen)
✅ Abonnement kündigen
❌ Pause (nicht erlaubt)
```

---

## 10. Rechnungsstellung

### 10.1 Rechnungsnummern-Generierung

```typescript
// lib/invoice-number.ts
export async function generateInvoiceNumber(): Promise<string> {
  const year = new Date().getFullYear();
  
  const lastInvoice = await prisma.invoice.findFirst({
    where: {
      invoiceNumber: {
        startsWith: `INV-${year}-`,
      },
    },
    orderBy: { createdAt: 'desc' },
  });
  
  let sequence = 1;
  
  if (lastInvoice?.invoiceNumber) {
    const lastSequence = parseInt(lastInvoice.invoiceNumber.split('-')[2], 10);
    sequence = lastSequence + 1;
  }
  
  return `INV-${year}-${sequence.toString().padStart(5, '0')}`;
}
```

### 10.2 Rechnungs-PDF (optional, wenn nicht Stripe PDF)

```typescript
// lib/invoice-pdf.ts
import { Document, Page, Text, View, renderToBuffer } from '@react-pdf/renderer';

export async function generateInvoicePdf(invoiceId: string): Promise<Buffer> {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      tenant: true,
      subscription: { include: { plan: true } },
    },
  });
  
  // PDF generieren mit @react-pdf/renderer
  // ... (ähnlich wie DATEV-PDF)
}
```

---

## 11. Testmodus

### 11.1 Stripe Test-Keys

```env
# .env.development
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_PUBLISHABLE_KEY=pk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx

# .env.production
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_PUBLISHABLE_KEY=pk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
```

### 11.2 Test-Kreditkarten

| Karte | Nummer | Ergebnis |
|-------|--------|----------|
| Erfolg | 4242 4242 4242 4242 | Zahlung erfolgreich |
| Abgelehnt | 4000 0000 0000 0002 | Karte abgelehnt |
| 3D Secure | 4000 0025 0000 3155 | 3D Secure erforderlich |
| Unzureichend | 4000 0000 0000 9995 | Insufficient funds |

---

## 12. Checkliste für Implementierung

- [ ] Stripe-Account erstellen und konfigurieren
- [ ] Produkte und Preise in Stripe anlegen
- [ ] Webhook-Endpoint einrichten
- [ ] Datenbank-Tabellen erstellen
- [ ] Checkout-Flow implementieren
- [ ] Webhook-Handler implementieren
- [ ] Usage-Tracking implementieren
- [ ] Customer Portal einrichten
- [ ] Dunning-E-Mails konfigurieren
- [ ] Limit-Warnungen implementieren
- [ ] Upgrade/Downgrade testen
- [ ] Zahlungsausfall-Flow testen
- [ ] SEPA-Lastschrift aktivieren
- [ ] Rechnungen testen
