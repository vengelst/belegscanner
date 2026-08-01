# Onboarding-Flow – End-to-End Architektur

## 1. Übersicht

Dieses Dokument beschreibt den kompletten Onboarding-Prozess für neue Kunden der SaaS-Belegverwaltung, von der ersten Registrierung bis zur aktiven Nutzung.

### Ziele
- **Einfachheit**: Registrierung in unter 2 Minuten
- **Vertrauen**: Professioneller erster Eindruck
- **Aktivierung**: Schneller Weg zum ersten Erfolgserlebnis
- **Konversion**: Hohe Trial-zu-Paid Conversion Rate

---

## 2. Onboarding-Phasen

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           ONBOARDING-JOURNEY                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐      │
│  │  PHASE 1│   │ PHASE 2 │   │ PHASE 3 │   │ PHASE 4 │   │ PHASE 5 │      │
│  │         │   │         │   │         │   │         │   │         │      │
│  │ Regis-  │──▶│ E-Mail  │──▶│ Setup   │──▶│ Erster  │──▶│ Trial   │      │
│  │ trierung│   │ Verifi- │   │ Wizard  │   │ Beleg   │   │ → Paid  │      │
│  │         │   │ kation  │   │         │   │         │   │         │      │
│  └─────────┘   └─────────┘   └─────────┘   └─────────┘   └─────────┘      │
│                                                                              │
│  ~30 Sek.      ~10 Sek.      ~60 Sek.      ~30 Sek.      14 Tage           │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Phase 1: Registrierung

### 3.1 Registrierungsformular

```
┌─────────────────────────────────────────────────────────────┐
│                                                              │
│                    Jetzt kostenlos testen                    │
│                      14 Tage • Keine Kreditkarte             │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Firmenname *                                            │ │
│  │ ┌──────────────────────────────────────────────────┐   │ │
│  │ │ Musterfirma GmbH                                 │   │ │
│  │ └──────────────────────────────────────────────────┘   │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Ihre E-Mail *                                          │ │
│  │ ┌──────────────────────────────────────────────────┐   │ │
│  │ │ max.mustermann@musterfirma.de                    │   │ │
│  │ └──────────────────────────────────────────────────┘   │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Passwort * (mind. 8 Zeichen)                           │ │
│  │ ┌──────────────────────────────────────────────────┐   │ │
│  │ │ ••••••••••••                                     │   │ │
│  │ └──────────────────────────────────────────────────┘   │ │
│  │ ████████░░ Stark                                       │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  ☑ Ich akzeptiere die AGB und Datenschutzerklärung          │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │              Kostenlos registrieren →                   │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  Bereits registriert? Hier anmelden                         │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 API: Registrierung

```typescript
// app/api/auth/register/route.ts
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth';
import { generateSlug } from '@/lib/utils';
import { sendVerificationEmail } from '@/lib/email';
import { createTenantEncryptionKey } from '@/lib/encryption-service';
import { registerSchema } from '@/lib/validation';

export async function POST(req: Request) {
  const body = await req.json();
  
  // Validierung
  const validation = registerSchema.safeParse(body);
  if (!validation.success) {
    return Response.json(
      { error: 'Validierungsfehler', details: validation.error.flatten() },
      { status: 400 }
    );
  }
  
  const { companyName, email, password } = validation.data;
  
  // E-Mail bereits registriert?
  const existingUser = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  });
  
  if (existingUser) {
    return Response.json(
      { error: 'Diese E-Mail-Adresse ist bereits registriert.' },
      { status: 409 }
    );
  }
  
  // Slug generieren
  const baseSlug = generateSlug(companyName);
  let slug = baseSlug;
  let counter = 1;
  
  while (await prisma.tenant.findUnique({ where: { slug } })) {
    slug = `${baseSlug}-${counter}`;
    counter++;
  }
  
  // Transaktion: Tenant + User + Encryption Key erstellen
  const result = await prisma.$transaction(async (tx) => {
    // 1. Tenant erstellen
    const tenant = await tx.tenant.create({
      data: {
        slug,
        name: companyName,
        email: email.toLowerCase(),
        status: 'pending', // Wird nach E-Mail-Verifizierung "active"
      },
    });
    
    // 2. Verschlüsselungsschlüssel erstellen
    await createTenantEncryptionKey(tenant.id);
    
    // 3. Admin-User erstellen
    const user = await tx.user.create({
      data: {
        tenantId: tenant.id,
        email: email.toLowerCase(),
        name: companyName, // Wird im Setup-Wizard aktualisiert
        passwordHash: await hashPassword(password),
        role: 'tenant_admin',
        active: true,
        emailVerified: false,
      },
    });
    
    // 4. Subscription erstellen (Trial)
    const starterPlan = await tx.plan.findFirst({
      where: { slug: 'starter' },
    });
    
    await tx.subscription.create({
      data: {
        tenantId: tenant.id,
        planId: starterPlan?.id,
        status: 'trialing',
        trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 Tage
      },
    });
    
    return { tenant, user };
  });
  
  // E-Mail-Verifizierung senden
  const verificationToken = await createVerificationToken(result.user.id);
  await sendVerificationEmail(email, verificationToken);
  
  // Audit Log
  await audit(result.tenant.id, result.user.id, {
    action: 'CREATE',
    entityType: 'tenant',
    entityId: result.tenant.id,
    newValues: { name: companyName, slug },
  });
  
  return Response.json({
    success: true,
    message: 'Registrierung erfolgreich. Bitte bestätigen Sie Ihre E-Mail.',
    tenantSlug: slug,
  });
}
```

### 3.3 Validierung

```typescript
// lib/validation.ts
import { z } from 'zod';

export const registerSchema = z.object({
  companyName: z
    .string()
    .min(2, 'Firmenname muss mindestens 2 Zeichen haben')
    .max(100, 'Firmenname darf maximal 100 Zeichen haben')
    .regex(/^[a-zA-ZäöüÄÖÜß0-9\s\-&.]+$/, 'Ungültige Zeichen im Firmennamen'),
    
  email: z
    .string()
    .email('Ungültige E-Mail-Adresse')
    .max(255),
    
  password: z
    .string()
    .min(8, 'Passwort muss mindestens 8 Zeichen haben')
    .max(72, 'Passwort darf maximal 72 Zeichen haben') // bcrypt Limit
    .regex(/[a-z]/, 'Passwort muss mindestens einen Kleinbuchstaben enthalten')
    .regex(/[A-Z]/, 'Passwort muss mindestens einen Großbuchstaben enthalten')
    .regex(/[0-9]/, 'Passwort muss mindestens eine Zahl enthalten'),
    
  acceptTerms: z.literal(true, {
    errorMap: () => ({ message: 'Sie müssen die AGB akzeptieren' }),
  }),
});
```

### 3.4 Slug-Generierung

```typescript
// lib/utils.ts
export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    // Umlaute ersetzen
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    // Sonderzeichen entfernen
    .replace(/[^a-z0-9\s-]/g, '')
    // Leerzeichen zu Bindestrichen
    .replace(/\s+/g, '-')
    // Mehrfache Bindestriche
    .replace(/-+/g, '-')
    // Max 50 Zeichen
    .substring(0, 50)
    // Führende/Trailing Bindestriche entfernen
    .replace(/^-+|-+$/g, '');
}
```

---

## 4. Phase 2: E-Mail-Verifizierung

### 4.1 Verifizierungs-E-Mail

```html
Betreff: Bestätigen Sie Ihre E-Mail – BelegBox

──────────────────────────────────────────────────────────────

Hallo,

vielen Dank für Ihre Registrierung bei BelegBox!

Bitte bestätigen Sie Ihre E-Mail-Adresse, indem Sie auf den 
folgenden Button klicken:

        ┌─────────────────────────────────────┐
        │     E-Mail-Adresse bestätigen →     │
        └─────────────────────────────────────┘

Oder kopieren Sie diesen Link in Ihren Browser:
https://app.belegbox.de/verify?token=xxx

Dieser Link ist 24 Stunden gültig.

Falls Sie sich nicht bei BelegBox registriert haben, 
können Sie diese E-Mail ignorieren.

Mit freundlichen Grüßen
Ihr BelegBox-Team

──────────────────────────────────────────────────────────────
```

### 4.2 Verifizierungs-Token

```sql
CREATE TABLE verification_tokens (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token           VARCHAR(255) UNIQUE NOT NULL,
    type            VARCHAR(20) NOT NULL,  -- email, password_reset
    expires_at      TIMESTAMPTZ NOT NULL,
    used_at         TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_verification_token ON verification_tokens(token);
CREATE INDEX idx_verification_expires ON verification_tokens(expires_at);
```

### 4.3 Token-Erstellung und Verifizierung

```typescript
// lib/verification.ts
import { randomBytes } from 'crypto';
import { prisma } from '@/lib/prisma';

export async function createVerificationToken(
  userId: string,
  type: 'email' | 'password_reset' = 'email'
): Promise<string> {
  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 Stunden
  
  await prisma.verificationToken.create({
    data: {
      userId,
      token,
      type,
      expiresAt,
    },
  });
  
  return token;
}

export async function verifyToken(token: string, type: string) {
  const record = await prisma.verificationToken.findFirst({
    where: {
      token,
      type,
      expiresAt: { gt: new Date() },
      usedAt: null,
    },
    include: { user: true },
  });
  
  if (!record) {
    return { valid: false, error: 'Token ungültig oder abgelaufen' };
  }
  
  // Token als verwendet markieren
  await prisma.verificationToken.update({
    where: { id: record.id },
    data: { usedAt: new Date() },
  });
  
  return { valid: true, user: record.user };
}
```

### 4.4 Verifizierungs-Endpoint

```typescript
// app/api/auth/verify-email/route.ts
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/verification';

export async function POST(req: Request) {
  const { token } = await req.json();
  
  const result = await verifyToken(token, 'email');
  
  if (!result.valid) {
    return Response.json({ error: result.error }, { status: 400 });
  }
  
  // User und Tenant aktivieren
  await prisma.$transaction([
    prisma.user.update({
      where: { id: result.user!.id },
      data: { emailVerified: true },
    }),
    prisma.tenant.update({
      where: { id: result.user!.tenantId },
      data: { status: 'active' },
    }),
  ]);
  
  return Response.json({
    success: true,
    redirectUrl: `/onboarding/setup`,
  });
}
```

---

## 5. Phase 3: Setup-Wizard

### 5.1 Wizard-Schritte

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ● ○ ○ ○                                              Schritt 1 von 4       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│                        Willkommen bei BelegBox!                              │
│                                                                              │
│              Lassen Sie uns Ihr Konto einrichten. Das dauert                │
│                        nur etwa eine Minute.                                 │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ Ihr vollständiger Name *                                               │ │
│  │ ┌────────────────────────────────────────────────────────────────────┐ │ │
│  │ │ Max Mustermann                                                     │ │ │
│  │ └────────────────────────────────────────────────────────────────────┘ │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ Telefonnummer (optional)                                               │ │
│  │ ┌────────────────────────────────────────────────────────────────────┐ │ │
│  │ │ +49 123 456789                                                     │ │ │
│  │ └────────────────────────────────────────────────────────────────────┘ │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│                                                       ┌───────────────────┐ │
│                                                       │    Weiter →       │ │
│                                                       └───────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  ● ● ○ ○                                              Schritt 2 von 4       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│                          Firmeninformationen                                 │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ Straße und Hausnummer                                                  │ │
│  │ ┌────────────────────────────────────────────────────────────────────┐ │ │
│  │ │ Musterstraße 123                                                   │ │ │
│  │ └────────────────────────────────────────────────────────────────────┘ │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  ┌──────────────────────┐  ┌─────────────────────────────────────────────┐ │
│  │ PLZ                  │  │ Stadt                                       │ │
│  │ ┌──────────────────┐ │  │ ┌─────────────────────────────────────────┐ │ │
│  │ │ 12345            │ │  │ │ Musterstadt                             │ │ │
│  │ └──────────────────┘ │  │ └─────────────────────────────────────────┘ │ │
│  └──────────────────────┘  └─────────────────────────────────────────────┘ │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ Land                                                                   │ │
│  │ ┌────────────────────────────────────────────────────────────────────┐ │ │
│  │ │ 🇩🇪 Deutschland                                              ▼   │ │ │
│  │ └────────────────────────────────────────────────────────────────────┘ │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  ┌───────────────────┐                                ┌───────────────────┐ │
│  │    ← Zurück       │                                │    Weiter →       │ │
│  └───────────────────┘                                └───────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  ● ● ● ○                                              Schritt 3 von 4       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│                           DATEV-Einstellungen                                │
│                                                                              │
│              Nutzen Sie DATEV? Richten Sie den Export ein.                  │
│                      (Sie können das später ändern)                          │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ ☑ Ich möchte Belege an DATEV senden                                    │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ DATEV E-Mail-Adresse                                                   │ │
│  │ ┌────────────────────────────────────────────────────────────────────┐ │ │
│  │ │ buchung@datev.de                                                   │ │ │
│  │ └────────────────────────────────────────────────────────────────────┘ │ │
│  │ ⓘ Diese Adresse erhalten Sie von Ihrem Steuerberater                  │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  ┌───────────────────┐                                ┌───────────────────┐ │
│  │    ← Zurück       │                                │    Weiter →       │ │
│  └───────────────────┘                                └───────────────────┘ │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                        Überspringen →                                   │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  ● ● ● ●                                              Schritt 4 von 4       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│                              🎉 Geschafft!                                   │
│                                                                              │
│              Ihr Konto ist eingerichtet. Sie haben 14 Tage                  │
│                    kostenlosen Zugang zu allen Funktionen.                   │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                                                                        │ │
│  │   📱 Erster Beleg hochladen                                           │ │
│  │      Fotografieren Sie einen Beleg und laden Sie ihn hoch             │ │
│  │                                                                        │ │
│  │   👥 Team einladen                                                     │ │
│  │      Laden Sie Mitarbeiter zu Ihrem Konto ein                         │ │
│  │                                                                        │ │
│  │   ⚙️  Einstellungen anpassen                                           │ │
│  │      Kategorien, Fahrzeuge und mehr konfigurieren                     │ │
│  │                                                                        │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│                        ┌───────────────────────────────┐                    │
│                        │   Ersten Beleg hochladen →    │                    │
│                        └───────────────────────────────┘                    │
│                                                                              │
│                        Oder zum Dashboard →                                  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 5.2 Onboarding-Status speichern

```sql
CREATE TABLE onboarding_progress (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID UNIQUE NOT NULL REFERENCES tenants(id),
    
    -- Fortschritt
    current_step    INTEGER DEFAULT 1,
    completed       BOOLEAN DEFAULT FALSE,
    
    -- Welche Schritte wurden abgeschlossen
    steps_completed JSONB DEFAULT '{}',
    -- {"profile": true, "company": true, "datev": false, "welcome": false}
    
    -- Optionale Felder aus dem Wizard
    wizard_data     JSONB DEFAULT '{}',
    
    -- Timestamps
    started_at      TIMESTAMPTZ DEFAULT NOW(),
    completed_at    TIMESTAMPTZ,
    
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);
```

### 5.3 Setup-API

```typescript
// app/api/onboarding/setup/route.ts
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET: Aktuellen Fortschritt laden
export async function GET(req: Request) {
  const session = await requireAuth();
  
  const progress = await prisma.onboardingProgress.findUnique({
    where: { tenantId: session.tenantId },
  });
  
  if (!progress) {
    // Neu erstellen
    const newProgress = await prisma.onboardingProgress.create({
      data: { tenantId: session.tenantId },
    });
    return Response.json(newProgress);
  }
  
  return Response.json(progress);
}

// POST: Schritt speichern
export async function POST(req: Request) {
  const session = await requireAuth();
  const { step, data } = await req.json();
  
  const progress = await prisma.onboardingProgress.findUnique({
    where: { tenantId: session.tenantId },
  });
  
  // Schritt-spezifische Logik
  switch (step) {
    case 'profile':
      await prisma.user.update({
        where: { id: session.userId },
        data: {
          name: data.name,
          // phone in separater Tabelle oder JSON
        },
      });
      break;
      
    case 'company':
      await prisma.tenant.update({
        where: { id: session.tenantId },
        data: {
          street: data.street,
          zip: data.zip,
          city: data.city,
          countryCode: data.countryCode,
        },
      });
      break;
      
    case 'datev':
      if (data.enableDatev) {
        await prisma.datevProfile.create({
          data: {
            tenantId: session.tenantId,
            name: 'Standard',
            datevAddress: data.datevEmail,
            senderAddress: session.email,
            isDefault: true,
            active: true,
          },
        });
      }
      break;
      
    case 'complete':
      await prisma.onboardingProgress.update({
        where: { tenantId: session.tenantId },
        data: {
          completed: true,
          completedAt: new Date(),
        },
      });
      break;
  }
  
  // Fortschritt aktualisieren
  const stepsCompleted = {
    ...(progress?.stepsCompleted as object || {}),
    [step]: true,
  };
  
  await prisma.onboardingProgress.update({
    where: { tenantId: session.tenantId },
    data: {
      currentStep: progress?.currentStep ? progress.currentStep + 1 : 2,
      stepsCompleted,
      wizardData: {
        ...(progress?.wizardData as object || {}),
        [step]: data,
      },
    },
  });
  
  return Response.json({ success: true });
}
```

---

## 6. Phase 4: Erster Beleg (Activation)

### 6.1 Guided Upload

```typescript
// components/onboarding/first-receipt-guide.tsx
'use client';

import { useState } from 'react';
import { Upload, Camera, CheckCircle } from 'lucide-react';

export function FirstReceiptGuide() {
  const [step, setStep] = useState<'upload' | 'processing' | 'success'>('upload');
  
  return (
    <div className="max-w-lg mx-auto p-6">
      {step === 'upload' && (
        <div className="text-center">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Upload className="w-8 h-8 text-primary" />
          </div>
          
          <h2 className="text-xl font-semibold mb-2">
            Laden Sie Ihren ersten Beleg hoch
          </h2>
          
          <p className="text-muted-foreground mb-6">
            Unsere KI erkennt automatisch alle wichtigen Daten wie
            Datum, Betrag und Lieferant.
          </p>
          
          <div className="grid grid-cols-2 gap-4">
            <button className="flex flex-col items-center p-4 border-2 border-dashed rounded-lg hover:border-primary hover:bg-primary/5 transition-colors">
              <Camera className="w-8 h-8 mb-2 text-muted-foreground" />
              <span className="font-medium">Foto aufnehmen</span>
              <span className="text-sm text-muted-foreground">Mit Kamera</span>
            </button>
            
            <button className="flex flex-col items-center p-4 border-2 border-dashed rounded-lg hover:border-primary hover:bg-primary/5 transition-colors">
              <Upload className="w-8 h-8 mb-2 text-muted-foreground" />
              <span className="font-medium">Datei wählen</span>
              <span className="text-sm text-muted-foreground">JPG, PNG, PDF</span>
            </button>
          </div>
        </div>
      )}
      
      {step === 'processing' && (
        <div className="text-center">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
          
          <h2 className="text-xl font-semibold mb-2">
            KI analysiert Ihren Beleg...
          </h2>
          
          <p className="text-muted-foreground">
            Das dauert nur wenige Sekunden.
          </p>
        </div>
      )}
      
      {step === 'success' && (
        <div className="text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          
          <h2 className="text-xl font-semibold mb-2">
            Perfekt! Ihr erster Beleg wurde erfasst.
          </h2>
          
          <p className="text-muted-foreground mb-6">
            So einfach ist das. Die KI hat alle Daten automatisch erkannt.
          </p>
          
          <div className="bg-muted/50 rounded-lg p-4 text-left mb-6">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <span className="text-muted-foreground">Datum:</span>
              <span className="font-medium">15.07.2026</span>
              <span className="text-muted-foreground">Betrag:</span>
              <span className="font-medium">45,90 €</span>
              <span className="text-muted-foreground">Lieferant:</span>
              <span className="font-medium">REWE</span>
            </div>
          </div>
          
          <button className="w-full bg-primary text-primary-foreground py-3 rounded-lg font-medium">
            Weiter zum Dashboard
          </button>
        </div>
      )}
    </div>
  );
}
```

### 6.2 Activation Tracking

```typescript
// lib/activation.ts
import { prisma } from '@/lib/prisma';

export async function trackActivation(tenantId: string, event: string) {
  await prisma.activationEvent.create({
    data: {
      tenantId,
      event,
      occurredAt: new Date(),
    },
  });
  
  // Prüfen ob "aktiviert"
  const events = await prisma.activationEvent.findMany({
    where: { tenantId },
    select: { event: true },
  });
  
  const eventTypes = new Set(events.map(e => e.event));
  
  // Aktiviert wenn: E-Mail verifiziert + Setup abgeschlossen + erster Beleg
  const isActivated = 
    eventTypes.has('email_verified') &&
    eventTypes.has('setup_completed') &&
    eventTypes.has('first_receipt_created');
  
  if (isActivated) {
    await prisma.tenant.update({
      where: { id: tenantId },
      data: { activatedAt: new Date() },
    });
  }
}
```

---

## 7. Phase 5: Trial → Paid Conversion

### 7.1 Trial-Reminder-E-Mails

```
Tag 1:   Willkommens-E-Mail (bereits gesendet bei Registrierung)

Tag 7:   "So holen Sie das Beste aus BelegBox heraus"
         - Tipps & Tricks
         - Link zu Hilfe-Artikeln
         - Erinnerung: 7 Tage verbleibend

Tag 12:  "Ihre Testphase endet in 2 Tagen"
         - Zusammenfassung der Nutzung
         - "Sie haben X Belege erfasst"
         - Call-to-Action: Jetzt upgraden

Tag 14:  "Ihre Testphase endet heute"
         - Dringlichkeit
         - Was passiert nach Trial-Ende
         - Call-to-Action: Jetzt upgraden

Tag 15:  "Ihre Testphase ist abgelaufen"
         - Zugang eingeschränkt
         - Daten bleiben 30 Tage erhalten
         - Call-to-Action: Jetzt aktivieren
```

### 7.2 E-Mail-Scheduler

```typescript
// jobs/trial-reminder.ts
import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/email';
import { addDays, differenceInDays, isToday } from 'date-fns';

const REMINDER_DAYS = [7, 12, 14, 15];

export async function sendTrialReminders() {
  const today = new Date();
  
  // Alle Tenants im Trial
  const trialTenants = await prisma.tenant.findMany({
    where: {
      subscription: {
        status: 'trialing',
        trialEndsAt: { not: null },
      },
    },
    include: {
      subscription: true,
      users: { where: { role: 'tenant_admin' } },
    },
  });
  
  for (const tenant of trialTenants) {
    const trialEndsAt = tenant.subscription!.trialEndsAt!;
    const daysRemaining = differenceInDays(trialEndsAt, today);
    
    for (const reminderDay of REMINDER_DAYS) {
      if (daysRemaining === 14 - reminderDay) {
        await sendTrialReminderEmail(tenant, reminderDay);
      }
    }
    
    // Trial abgelaufen
    if (daysRemaining < 0) {
      await handleTrialExpired(tenant);
    }
  }
}

async function sendTrialReminderEmail(tenant: any, day: number) {
  const admin = tenant.users[0];
  
  const templates: Record<number, { subject: string; template: string }> = {
    7: {
      subject: 'So holen Sie das Beste aus BelegBox heraus',
      template: 'trial-tips',
    },
    12: {
      subject: 'Ihre Testphase endet in 2 Tagen',
      template: 'trial-ending-soon',
    },
    14: {
      subject: 'Ihre Testphase endet heute',
      template: 'trial-ending-today',
    },
    15: {
      subject: 'Ihre Testphase ist abgelaufen',
      template: 'trial-expired',
    },
  };
  
  const { subject, template } = templates[day];
  
  // Nutzungsstatistik für E-Mail
  const stats = await getTrialStats(tenant.id);
  
  await sendEmail({
    to: admin.email,
    subject,
    template,
    data: {
      name: admin.name,
      companyName: tenant.name,
      receiptsCreated: stats.receipts,
      daysUsed: stats.daysUsed,
      upgradeUrl: `https://${tenant.slug}.belegbox.de/settings/billing`,
    },
  });
}

async function handleTrialExpired(tenant: any) {
  // Subscription auf "paused" setzen
  await prisma.subscription.update({
    where: { tenantId: tenant.id },
    data: { status: 'paused' },
  });
  
  // Tenant-Funktionen einschränken (nicht sperren)
  await prisma.tenant.update({
    where: { id: tenant.id },
    data: { trialExpired: true },
  });
}
```

### 7.3 In-App Trial-Banner

```typescript
// components/trial-banner.tsx
'use client';

import { useSession } from 'next-auth/react';
import { differenceInDays } from 'date-fns';
import Link from 'next/link';

export function TrialBanner() {
  const { data: session } = useSession();
  
  if (!session?.subscription || session.subscription.status !== 'trialing') {
    return null;
  }
  
  const trialEndsAt = new Date(session.subscription.trialEndsAt);
  const daysRemaining = differenceInDays(trialEndsAt, new Date());
  
  if (daysRemaining < 0) {
    return (
      <div className="bg-red-600 text-white px-4 py-2 text-center text-sm">
        <span>Ihre Testphase ist abgelaufen. </span>
        <Link href="/settings/billing" className="underline font-medium">
          Jetzt upgraden
        </Link>
        <span> um alle Funktionen freizuschalten.</span>
      </div>
    );
  }
  
  if (daysRemaining <= 3) {
    return (
      <div className="bg-amber-500 text-white px-4 py-2 text-center text-sm">
        <span>
          Ihre Testphase endet in {daysRemaining} {daysRemaining === 1 ? 'Tag' : 'Tagen'}.{' '}
        </span>
        <Link href="/settings/billing" className="underline font-medium">
          Jetzt upgraden
        </Link>
      </div>
    );
  }
  
  return (
    <div className="bg-blue-600 text-white px-4 py-2 text-center text-sm">
      <span>
        Sie testen BelegBox kostenlos – noch {daysRemaining} Tage.{' '}
      </span>
      <Link href="/settings/billing" className="underline font-medium">
        Tarife ansehen
      </Link>
    </div>
  );
}
```

---

## 8. Team-Einladung

### 8.1 Einladungs-Flow

```
Admin lädt ein → E-Mail gesendet → User klickt Link → 
→ Passwort setzen → Eingeloggt
```

### 8.2 Einladungs-Tabelle

```sql
CREATE TABLE invitations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    invited_by_id   UUID NOT NULL REFERENCES users(id),
    
    email           VARCHAR(255) NOT NULL,
    role            VARCHAR(20) NOT NULL DEFAULT 'member',
    token           VARCHAR(255) UNIQUE NOT NULL,
    
    expires_at      TIMESTAMPTZ NOT NULL,
    accepted_at     TIMESTAMPTZ,
    
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(tenant_id, email)
);

CREATE INDEX idx_invitations_token ON invitations(token);
CREATE INDEX idx_invitations_email ON invitations(email);
```

### 8.3 Einladungs-API

```typescript
// app/api/team/invite/route.ts
import { requireAuth, requireRole } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { sendInvitationEmail } from '@/lib/email';
import { randomBytes } from 'crypto';

export async function POST(req: Request) {
  const session = await requireAuth();
  await requireRole(session, ['tenant_admin']);
  
  const { email, role } = await req.json();
  
  // Limit prüfen
  const usageService = new UsageService(session.tenantId);
  const userLimit = await usageService.checkLimit('users');
  
  if (!userLimit.allowed) {
    return Response.json(
      { error: 'Benutzerlimit erreicht. Bitte upgraden Sie Ihren Tarif.' },
      { status: 403 }
    );
  }
  
  // Bereits eingeladen oder registriert?
  const existing = await prisma.user.findFirst({
    where: {
      email: email.toLowerCase(),
      tenantId: session.tenantId,
    },
  });
  
  if (existing) {
    return Response.json(
      { error: 'Diese E-Mail ist bereits in Ihrem Team.' },
      { status: 409 }
    );
  }
  
  const existingInvite = await prisma.invitation.findFirst({
    where: {
      email: email.toLowerCase(),
      tenantId: session.tenantId,
      acceptedAt: null,
      expiresAt: { gt: new Date() },
    },
  });
  
  if (existingInvite) {
    return Response.json(
      { error: 'Eine Einladung für diese E-Mail ist bereits aktiv.' },
      { status: 409 }
    );
  }
  
  // Einladung erstellen
  const token = randomBytes(32).toString('hex');
  
  const invitation = await prisma.invitation.create({
    data: {
      tenantId: session.tenantId,
      invitedById: session.userId,
      email: email.toLowerCase(),
      role,
      token,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 Tage
    },
  });
  
  // E-Mail senden
  const tenant = await prisma.tenant.findUnique({
    where: { id: session.tenantId },
  });
  
  await sendInvitationEmail({
    to: email,
    inviterName: session.name,
    companyName: tenant!.name,
    acceptUrl: `https://${tenant!.slug}.belegbox.de/invite/accept?token=${token}`,
  });
  
  return Response.json({ success: true, invitation });
}
```

### 8.4 Einladung annehmen

```typescript
// app/api/team/accept-invite/route.ts
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth';

export async function POST(req: Request) {
  const { token, name, password } = await req.json();
  
  const invitation = await prisma.invitation.findFirst({
    where: {
      token,
      acceptedAt: null,
      expiresAt: { gt: new Date() },
    },
    include: { tenant: true },
  });
  
  if (!invitation) {
    return Response.json(
      { error: 'Einladung ungültig oder abgelaufen.' },
      { status: 400 }
    );
  }
  
  // User erstellen
  const user = await prisma.user.create({
    data: {
      tenantId: invitation.tenantId,
      email: invitation.email,
      name,
      passwordHash: await hashPassword(password),
      role: invitation.role,
      active: true,
      emailVerified: true, // Durch Einladung verifiziert
    },
  });
  
  // Einladung als akzeptiert markieren
  await prisma.invitation.update({
    where: { id: invitation.id },
    data: { acceptedAt: new Date() },
  });
  
  // Usage-Counter erhöhen
  const usageService = new UsageService(invitation.tenantId);
  await usageService.incrementUsers();
  
  return Response.json({
    success: true,
    redirectUrl: `https://${invitation.tenant.slug}.belegbox.de/login`,
  });
}
```

---

## 9. Onboarding-Metriken

### 9.1 Key Metrics

| Metrik | Beschreibung | Zielwert |
|--------|--------------|----------|
| **Registrierungsrate** | Besucher → Registrierung | > 5% |
| **Verifizierungsrate** | Registrierung → E-Mail verifiziert | > 80% |
| **Setup-Completion** | Verifiziert → Setup abgeschlossen | > 70% |
| **Activation Rate** | Setup → Erster Beleg | > 60% |
| **Trial-to-Paid** | Trial → Bezahlkunde | > 10% |
| **Time-to-Value** | Registrierung → Erster Beleg | < 10 Min |

### 9.2 Tracking-Events

```typescript
// lib/analytics.ts
export async function trackOnboardingEvent(
  tenantId: string,
  event: string,
  properties?: Record<string, any>
) {
  await prisma.analyticsEvent.create({
    data: {
      tenantId,
      event,
      properties,
      occurredAt: new Date(),
    },
  });
  
  // Optional: An externe Analytics senden (Mixpanel, Amplitude, etc.)
  if (process.env.MIXPANEL_TOKEN) {
    mixpanel.track(event, {
      distinct_id: tenantId,
      ...properties,
    });
  }
}

// Events:
// - registration_started
// - registration_completed
// - email_verification_sent
// - email_verified
// - setup_step_completed (step: 1-4)
// - setup_completed
// - first_receipt_uploaded
// - first_receipt_completed
// - team_member_invited
// - billing_page_viewed
// - checkout_started
// - checkout_completed
// - trial_reminder_sent (day: 7, 12, 14)
```

---

## 10. Checkliste für Implementierung

### Phase 1: Registrierung
- [ ] Registrierungsformular erstellen
- [ ] Validierung implementieren
- [ ] Slug-Generierung
- [ ] Tenant + User + Subscription in Transaktion erstellen
- [ ] E-Mail-Template erstellen

### Phase 2: E-Mail-Verifizierung
- [ ] Verifizierungs-Token-Tabelle
- [ ] Token-Erstellung und -Prüfung
- [ ] Verifizierungs-Endpoint
- [ ] E-Mail-Template

### Phase 3: Setup-Wizard
- [ ] Wizard-UI (4 Schritte)
- [ ] Onboarding-Progress-Tabelle
- [ ] API für jeden Schritt
- [ ] Skip-Option für optionale Schritte

### Phase 4: Activation
- [ ] First-Receipt-Guide
- [ ] Activation-Tracking
- [ ] Erfolgs-Animation

### Phase 5: Trial-Conversion
- [ ] Trial-Reminder-Cron-Job
- [ ] E-Mail-Templates (Tag 7, 12, 14, 15)
- [ ] In-App Trial-Banner
- [ ] Graceful Degradation bei Trial-Ende

### Team-Einladung
- [ ] Einladungs-Tabelle
- [ ] Einladungs-API
- [ ] Accept-Invite-Flow
- [ ] E-Mail-Template

### Analytics
- [ ] Event-Tracking implementieren
- [ ] Dashboard für Metriken (optional)
