# BelegBox -- Architektur- und Fachkonzept

Version: 1.0
Stand: 2026-04-01
Status: Zielkonzept fuer MVP-Umsetzung

---

## 1. Gesamtarchitektur

### 1.1 Uebersicht

```
┌─────────────────────────────────────────────────────────┐
│                      Client                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ Mobile Web   │  │ Desktop Web  │  │ Kiosk-Modus  │  │
│  │ (Erfassung)  │  │ (Verwaltung) │  │ (PIN-Login)  │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  │
│         └──────────────────┼──────────────────┘         │
└────────────────────────────┼────────────────────────────┘
                             │ HTTPS
┌────────────────────────────┼────────────────────────────┐
│                    Next.js Server                       │
│  ┌─────────────────────────┴──────────────────────────┐ │
│  │              API Routes (/api/*)                    │ │
│  ├────────────┬──────────┬───────────┬────────────────┤ │
│  │   Auth     │ Receipts │  Master   │   Settings     │ │
│  │  Module    │  Module  │   Data    │    Module      │ │
│  └─────┬──────┴─────┬────┴─────┬────┴───────┬────────┘ │
│        │            │          │             │          │
│  ┌─────┴──┐  ┌──────┴───┐  ┌──┴──┐  ┌──────┴───────┐  │
│  │NextAuth│  │ OCR      │  │Prisma│  │  Nodemailer  │  │
│  │  JWT   │  │ Service  │  │ ORM  │  │  SMTP Client │  │
│  └────────┘  └──────────┘  └──┬───┘  └──────────────┘  │
│                               │                         │
│  ┌────────────────────────────┴──────────────────────┐  │
│  │              PDF-Generator (@react-pdf)            │  │
│  └───────────────────────────────────────────────────┘  │
└────────────────────────────┬────────────────────────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
        ┌─────┴─────┐ ┌─────┴────┐ ┌──────┴──────┐
        │ PostgreSQL │ │  Lokaler │ │  Externer   │
        │  Datenbank │ │  Storage │ │  Wechselkurs│
        │            │ │ (Dateien)│ │  API (ECB)  │
        └────────────┘ └──────────┘ └─────────────┘
```

### 1.2 Technologie-Stack

| Schicht       | Technologie                | Begruendung                                                |
|---------------|----------------------------|------------------------------------------------------------|
| Frontend      | Next.js 15 App Router      | SSR + CSR, ein Projekt fuer alles, React Server Components |
| Sprache       | TypeScript (strict)        | Typsicherheit ueber gesamten Stack                         |
| Styling       | Tailwind CSS 4             | Utility-first, responsive, Dark Mode nativ                 |
| Datenbank     | PostgreSQL 16              | Robust, JSON-Support, Volltextsuche nativ                  |
| ORM           | Prisma 6                   | Typsicheres DB-Schema, Migrationen, guter DX               |
| Auth          | NextAuth.js v5             | JWT-basiert, Credentials Provider, erweiterbar             |
| OCR           | Tesseract.js (Server)      | Kostenlos, offline, fuer MVP ausreichend                   |
| Mail          | Nodemailer                 | Standard SMTP-Client fuer Node.js                          |
| PDF           | @react-pdf/renderer        | Leichtgewichtig, React-Komponenten als PDF                 |
| Storage       | Lokales Dateisystem        | Einfach fuer MVP, spaeter S3-kompatibel abstrahierbar      |
| Wechselkurse  | frankfurter.app API        | Kostenlos, basiert auf EZB-Daten, kein API-Key noetig      |

### 1.3 Architekturentscheidungen

**Monolith statt Microservices:** Ein Next.js-Projekt fuer Frontend und Backend. Fuer ein Team und ein MVP ist ein Monolith schneller, einfacher zu deployen und zu debuggen. Die interne Modularisierung erlaubt spaeteres Aufbrechen.

**App Router statt Pages Router:** Server Components reduzieren Client-Bundle, Server Actions vereinfachen Formulare, Layouts ermoeglichen geteilte Navigation.

**JWT statt Sessions:** Stateless Auth passt zum serverlosen Deployment. PIN-Login wird als eigener Credentials Provider implementiert.

**Lokaler Storage statt S3:** Fuer MVP genuegt das Dateisystem. Die Storage-Schicht wird hinter einem Interface abstrahiert, sodass spaeter S3/MinIO eingesteckt werden kann, ohne Anwendungscode zu aendern.

**Tesseract.js statt Cloud-OCR:** Keine externen Abhaengigkeiten, keine Kosten, keine Datenschutzprobleme. Genauigkeit fuer gedruckte Belege ausreichend. Spaeter als Provider austauschbar.

**@react-pdf statt Puppeteer:** Kein Headless-Chrome noetig, deutlich leichtere Abhaengigkeit, deterministisches PDF-Layout ueber React-Komponenten.

---

## 2. Datenmodell

### 2.1 Uebersicht Entity-Relationship

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│ Vehicle  │     │ Purpose  │     │ Category │     │ Country  │
│(Stamm)   │     │(Stamm)   │     │(Stamm)   │     │(Stamm)   │
└────┬─────┘     └────┬─────┘     └────┬─────┘     └────┬─────┘
     │                │                │                 │
     │   ┌────────────┼────────────────┼─────────────────┘
     │   │            │                │
     ▼   ▼            ▼                ▼
   ┌─────────────────────────────────────┐
   │              Receipt                │──────┐
   │           (Bewegungsdaten)          │      │
   └──┬──────────┬───────────┬───────────┘      │
      │          │           │                  │
      ▼          ▼           ▼                  ▼
┌──────────┐┌──────────┐┌──────────┐     ┌──────────┐
│Hospitality││  File   ││ SendLog  │     │  User    │
│(1:1 opt.) ││(1:N)    ││(1:N)     │     │(System)  │
└──────────┘└──────────┘└──────────┘     └──────────┘
                                              │
                                              ▼
                                         ┌──────────┐
                                         │ AuditLog │
                                         │(System)  │
                                         └──────────┘

                                         ┌──────────┐
                                         │SmtpConfig│
                                         │(System)  │
                                         └──────────┘
```

### 2.2 Vollstaendiges Prisma-Schema

```prisma
// schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ============================================================
// Enums
// ============================================================

enum Role {
  ADMIN
  USER
}

enum SendStatus {
  OPEN       // Beleg erfasst, noch nicht vollstaendig
  READY      // Beleg vollstaendig, bereit zum Versand
  SENT       // Erfolgreich an DATEV gesendet
  FAILED     // Versand fehlgeschlagen
  RETRY      // Zum erneuten Senden markiert
}

enum FileType {
  ORIGINAL   // Hochgeladenes Originalbild/-dokument
  PRINT_PDF  // Generierte Druckansicht
}

// ============================================================
// Stammdaten
// ============================================================

model Vehicle {
  id          String    @id @default(cuid())
  plate       String    @unique          // z.B. "B-AB 1234"
  description String?                    // z.B. "Firmenwagen VW Passat"
  active      Boolean   @default(true)
  sortOrder   Int       @default(0)
  createdAt   DateTime  @default(now())
  receipts    Receipt[]

  @@index([active, sortOrder])
}

model Purpose {
  id        String    @id @default(cuid())
  name      String    @unique            // z.B. "Tanken", "Bewirtung"
  active    Boolean   @default(true)
  sortOrder Int       @default(0)
  createdAt DateTime  @default(now())
  receipts  Receipt[]

  @@index([active, sortOrder])
}

model Category {
  id        String    @id @default(cuid())
  name      String    @unique            // z.B. "Kreditkarte", "Kasse"
  active    Boolean   @default(true)
  sortOrder Int       @default(0)
  createdAt DateTime  @default(now())
  receipts  Receipt[]

  @@index([active, sortOrder])
}

model Country {
  id        String    @id @default(cuid())
  code      String    @unique            // ISO 3166-1 alpha-2, z.B. "DE"
  name      String                       // z.B. "Deutschland"
  active    Boolean   @default(true)
  sortOrder Int       @default(0)
  createdAt DateTime  @default(now())
  receipts  Receipt[]

  @@index([active, sortOrder])
}

// ============================================================
// Benutzerverwaltung (Systemdaten)
// ============================================================

model User {
  id           String     @id @default(cuid())
  email        String     @unique
  name         String
  passwordHash String
  pinHash      String?                   // 4-stellige PIN, bcrypt-gehasht
  role         Role       @default(USER)
  active       Boolean    @default(true)
  createdAt    DateTime   @default(now())
  updatedAt    DateTime   @updatedAt
  receipts     Receipt[]
  auditLogs    AuditLog[]

  @@index([email])
  @@index([active])
}

// ============================================================
// Bewegungsdaten
// ============================================================

model Receipt {
  id                  String      @id @default(cuid())

  // Benutzer
  userId              String
  user                User        @relation(fields: [userId], references: [id])

  // Belegdaten
  date                DateTime    @db.Date          // Belegdatum
  supplier            String?                       // Lieferant (OCR oder manuell)

  // Betrag und Waehrung
  amount              Decimal     @db.Decimal(12,2) // Originalbetrag
  currency            String      @default("EUR")   // ISO 4217 Waehrungscode
  exchangeRate        Decimal?    @db.Decimal(18,8) // 1 EUR = X Fremdwaehrung
  exchangeRateDate    DateTime?   @db.Date          // Datum des Wechselkurses
  amountEur           Decimal     @db.Decimal(12,2) // Betrag in EUR

  // Zuordnungen (Stammdaten-Referenzen)
  countryId           String?
  country             Country?    @relation(fields: [countryId], references: [id])
  vehicleId           String?
  vehicle             Vehicle?    @relation(fields: [vehicleId], references: [id])
  purposeId           String
  purpose             Purpose     @relation(fields: [purposeId], references: [id])
  categoryId          String
  category            Category    @relation(fields: [categoryId], references: [id])

  // Versandstatus
  sendStatus          SendStatus  @default(OPEN)
  sendStatusUpdatedAt DateTime?

  // Freitext
  remark              String?     @db.Text

  // OCR-Rohdaten
  ocrRawText          String?     @db.Text

  // Relationen
  hospitality         Hospitality?
  files               ReceiptFile[]
  sendLogs            SendLog[]

  createdAt           DateTime    @default(now())
  updatedAt           DateTime    @updatedAt

  @@index([userId])
  @@index([sendStatus])
  @@index([date])
  @@index([purposeId])
  @@index([categoryId])
  @@index([countryId])
  @@index([createdAt])
}

// Bewirtungsdetails (1:1-Erweiterung, nur bei Zweck = Bewirtung)
model Hospitality {
  id        String  @id @default(cuid())
  receiptId String  @unique
  receipt   Receipt @relation(fields: [receiptId], references: [id], onDelete: Cascade)
  occasion  String                       // Anlass der Bewirtung
  guests    String  @db.Text             // Gaeste/Teilnehmer
  location  String                       // Ort der Bewirtung
}

// ============================================================
// Dateien
// ============================================================

model ReceiptFile {
  id          String   @id @default(cuid())
  receiptId   String
  receipt     Receipt  @relation(fields: [receiptId], references: [id], onDelete: Cascade)
  type        FileType
  mimeType    String                     // z.B. "image/jpeg", "application/pdf"
  filename    String                     // Originaler Dateiname
  storagePath String                     // Relativer Pfad im Storage
  sizeBytes   Int
  createdAt   DateTime @default(now())

  @@index([receiptId, type])
}

// ============================================================
// Systemdaten
// ============================================================

// SMTP-Konfiguration (Singleton-Zeile)
model SmtpConfig {
  id                String   @id @default("default")
  host              String
  port              Int      @default(587)
  secure            Boolean  @default(true)
  username          String
  passwordEncrypted String                // AES-256-GCM verschluesselt
  fromAddress       String                // Absender-Adresse
  datevAddress      String                // DATEV-Zieladresse
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
}

// Versandprotokoll
model SendLog {
  id           String   @id @default(cuid())
  receiptId    String
  receipt      Receipt  @relation(fields: [receiptId], references: [id])
  sentAt       DateTime @default(now())
  toAddress    String
  success      Boolean
  errorMessage String?  @db.Text
  messageId    String?                   // SMTP Message-ID
  createdAt    DateTime @default(now())

  @@index([receiptId])
  @@index([success])
  @@index([createdAt])
}

// Audit-Log
model AuditLog {
  id        String   @id @default(cuid())
  userId    String?
  user      User?    @relation(fields: [userId], references: [id])
  action    String                       // CREATE, UPDATE, DELETE, SEND, LOGIN, etc.
  entity    String                       // Receipt, User, SmtpConfig, etc.
  entityId  String?
  details   Json?                        // Aenderungsdetails als JSON
  createdAt DateTime @default(now())

  @@index([userId])
  @@index([entity, entityId])
  @@index([createdAt])
}
```

### 2.3 Datenklassifizierung

| Kategorie       | Tabellen                                      | Charakteristik                          |
|-----------------|-----------------------------------------------|-----------------------------------------|
| Stammdaten      | Vehicle, Purpose, Category, Country           | Selten geaendert, Admin-gepflegt        |
| Bewegungsdaten  | Receipt, Hospitality, ReceiptFile, SendLog    | Haeufig geschrieben, benutzerbezogen    |
| Systemdaten     | User, SmtpConfig, AuditLog                    | Konfiguration und Protokollierung       |

### 2.4 Seed-Daten (initiale Stammdaten)

**Purpose:** Buero, Ware, Asset, Tanken, Unterkunft, Bewirtung, Material, Maut, Parken, Sonstiges
**Category:** Kasse, Kreditkarte, EC-Karte, Bank, privat ausgelegt
**Country:** DE (Deutschland), AT (Oesterreich), CH (Schweiz), RS (Serbien), MK (Nordmazedonien) -- erweiterbar
**Admin-User:** Initialer Admin mit E-Mail + Passwort aus Umgebungsvariablen

---

## 3. Screenliste / UI-Struktur

### 3.1 Mobile Screens (Erfassungsfokus)

```
[M01] Login
  ├── E-Mail + Passwort
  └── PIN-Login (Kiosk)

[M02] Belegliste (Startseite)
  ├── Eigene Belege, neuste zuerst
  ├── Schnellfilter: Status-Chips
  ├── Pull-to-Refresh
  └── FAB-Button "Neuer Beleg"

[M03] Neuer Beleg
  ├── Kamera-Aufnahme (primaer)
  ├── Datei-Upload (alternativ)
  └── Weiter zu [M04]

[M04] OCR-Ergebnis & Bearbeitung
  ├── Belegbild-Vorschau (zoombar)
  ├── Erkannte Felder (Datum, Betrag, Waehrung, Lieferant)
  ├── Manuelle Korrektur aller Felder
  ├── Dropdowns: Land, Kfz, Zweck, Kategorie
  ├── Waehrungsblock (bei Fremdwaehrung)
  │   ├── Originalwaehrung + Betrag
  │   ├── Wechselkurs (auto-geladen, manuell korrigierbar)
  │   └── EUR-Betrag (berechnet)
  ├── Bewirtungsblock (bei Zweck = Bewirtung)
  │   ├── Anlass
  │   ├── Gaeste
  │   └── Ort
  ├── Bemerkung (Freitext)
  └── Aktionen: Speichern | Speichern & Senden

[M05] Beleg-Detail
  ├── Belegbild
  ├── Alle Felder (readonly oder editierbar)
  ├── Versandstatus mit Historie
  └── Aktionen: Bearbeiten | Senden | Erneut senden | Drucken

[M06] Einstellungen
  ├── Profil (Name, E-Mail)
  ├── PIN aendern
  ├── Theme (Hell/Dunkel)
  └── Abmelden
```

### 3.2 Desktop/Admin Screens (Verwaltungsfokus)

```
[D01] Login (identisch mit M01)

[D02] Dashboard
  ├── Uebersicht: Belege nach Status (Zaehler)
  ├── Letzte Belege
  └── Versand-Queue (offene/fehlgeschlagene)

[D03] Belegliste (erweitert)
  ├── Tabelle mit Sortierung
  ├── Erweiterte Filter
  │   ├── Benutzer
  │   ├── Land
  │   ├── Kfz
  │   ├── Zweck
  │   ├── Kategorie
  │   ├── Versandstatus
  │   └── Zeitraum (von/bis)
  ├── Volltextsuche
  ├── Bulk-Aktionen (Senden, Status aendern)
  └── Export (spaetere Erweiterung)

[D04] Beleg-Detail (identisch mit M05, breiteres Layout)

[D05] Druckansicht / PDF-Vorschau
  ├── DIN-A4-Layout
  ├── Belegbild oben
  ├── Strukturierte Infos unten
  └── PDF-Download

[D06] Benutzerverwaltung (Admin)
  ├── Benutzerliste
  ├── Benutzer anlegen/bearbeiten
  ├── Rolle zuweisen
  ├── PIN zuruecksetzen
  └── Benutzer deaktivieren

[D07] Stammdaten (Admin)
  ├── Kfz-Kennzeichen (CRUD)
  ├── Zwecke (CRUD)
  ├── Kategorien (CRUD)
  └── Laender (CRUD)

[D08] SMTP-Einstellungen (Admin)
  ├── Server, Port, Verschluesselung
  ├── Benutzername, Passwort
  ├── Absender-Adresse
  ├── DATEV-Zieladresse
  └── Test-Mail senden
```

### 3.3 Navigationsstruktur

**Mobile (Bottom Navigation):**
```
[ Belege ]  [ + Neu ]  [ Einstellungen ]
```

**Desktop (Sidebar):**
```
Dashboard
Belege
──────────────
Benutzer          (nur Admin)
Stammdaten        (nur Admin)
SMTP-Einstellungen (nur Admin)
──────────────
Einstellungen
```

### 3.4 Responsive Strategie

Kein separater Mobile-/Desktop-Build. Eine App mit responsiven Breakpoints:
- `< 768px`: Mobile-Layout (Stack, Bottom-Nav, grosse Touch-Targets)
- `>= 768px`: Desktop-Layout (Sidebar, Tabellen, Detailansicht neben Liste)

---

## 4. API-Struktur

Alle API-Routen unter `/api/`. Authentifizierung per JWT-Bearer-Token im Header.

### 4.1 Auth

| Methode | Route                    | Beschreibung               | Rolle     |
|---------|--------------------------|----------------------------|-----------|
| POST    | /api/auth/login          | Login mit E-Mail + Passwort| public    |
| POST    | /api/auth/pin-login      | Login mit PIN (Kiosk)      | public    |
| POST    | /api/auth/logout         | Session beenden            | auth      |
| GET     | /api/auth/me             | Eigenes Profil abrufen     | auth      |

### 4.2 Belege (Receipts)

| Methode | Route                          | Beschreibung                  | Rolle     |
|---------|--------------------------------|-------------------------------|-----------|
| GET     | /api/receipts                  | Liste mit Filtern + Paginierung| auth     |
| POST    | /api/receipts                  | Neuen Beleg anlegen           | auth      |
| GET     | /api/receipts/:id              | Einzelnen Beleg abrufen       | auth      |
| PUT     | /api/receipts/:id              | Beleg aktualisieren           | auth      |
| DELETE  | /api/receipts/:id              | Beleg loeschen                | auth      |
| POST    | /api/receipts/:id/send         | Beleg an DATEV senden         | auth      |
| POST    | /api/receipts/:id/retry        | Versand wiederholen           | auth      |
| GET     | /api/receipts/:id/pdf          | PDF generieren und ausliefern | auth      |
| GET     | /api/receipts/:id/send-log     | Versandhistorie abrufen       | auth      |

**Filter-Parameter fuer GET /api/receipts:**
```
?userId=...          // nur Admin: Belege anderer Benutzer
&sendStatus=OPEN,READY
&purposeId=...
&categoryId=...
&countryId=...
&vehicleId=...
&dateFrom=2026-01-01
&dateTo=2026-03-31
&search=Tankstelle   // Volltextsuche (Lieferant, Bemerkung, OCR-Text)
&page=1
&pageSize=20
&sortBy=date
&sortOrder=desc
```

**Autorisierungslogik:**
- USER sieht nur eigene Belege (`userId` wird serverseitig aus JWT gesetzt)
- ADMIN kann alle Belege sehen und filtern

### 4.3 OCR

| Methode | Route               | Beschreibung                          | Rolle |
|---------|---------------------|---------------------------------------|-------|
| POST    | /api/ocr/analyze    | Bild/PDF hochladen, OCR ausfuehren   | auth  |

**Request:** `multipart/form-data` mit Datei
**Response:**
```json
{
  "rawText": "...",
  "extracted": {
    "date": "2026-03-28",
    "amount": 47.50,
    "currency": "EUR",
    "supplier": "REWE Markt GmbH"
  },
  "confidence": 0.82
}
```

### 4.4 Dateien

| Methode | Route               | Beschreibung                    | Rolle |
|---------|---------------------|---------------------------------|-------|
| POST    | /api/files/upload   | Datei hochladen (zum Beleg)     | auth  |
| GET     | /api/files/:id      | Datei herunterladen / streamen  | auth  |

### 4.5 Stammdaten

Einheitliches CRUD-Pattern fuer alle Stammdaten-Entitaeten:

| Methode | Route                        | Beschreibung          | Rolle |
|---------|------------------------------|-----------------------|-------|
| GET     | /api/master/vehicles         | Alle Kfz auflisten   | auth  |
| POST    | /api/master/vehicles         | Kfz anlegen           | admin |
| PUT     | /api/master/vehicles/:id     | Kfz bearbeiten        | admin |
| DELETE  | /api/master/vehicles/:id     | Kfz deaktivieren      | admin |

Analog fuer: `/api/master/purposes`, `/api/master/categories`, `/api/master/countries`

**Hinweis:** DELETE fuehrt kein physisches Loeschen durch, sondern setzt `active = false`. Stammdaten mit bestehenden Belegreferenzen koennen nicht geloescht werden.

### 4.6 Benutzerverwaltung

| Methode | Route                   | Beschreibung             | Rolle |
|---------|-------------------------|--------------------------|-------|
| GET     | /api/users              | Benutzerliste            | admin |
| POST    | /api/users              | Benutzer anlegen         | admin |
| PUT     | /api/users/:id          | Benutzer bearbeiten      | admin |
| DELETE  | /api/users/:id          | Benutzer deaktivieren    | admin |
| PUT     | /api/users/:id/pin      | PIN setzen/aendern       | admin |
| PUT     | /api/users/me/pin       | Eigene PIN aendern       | auth  |
| PUT     | /api/users/me/password  | Eigenes Passwort aendern | auth  |

### 4.7 Einstellungen

| Methode | Route                    | Beschreibung              | Rolle |
|---------|--------------------------|---------------------------|-------|
| GET     | /api/settings/smtp       | SMTP-Konfiguration lesen  | admin |
| PUT     | /api/settings/smtp       | SMTP-Konfiguration setzen | admin |
| POST    | /api/settings/smtp/test  | Test-Mail senden          | admin |

### 4.8 Wechselkurse

| Methode | Route                     | Beschreibung                  | Rolle |
|---------|---------------------------|-------------------------------|-------|
| GET     | /api/exchange-rate        | Wechselkurs abrufen           | auth  |

**Parameter:** `?from=RSD&date=2026-03-28`
**Response:**
```json
{
  "from": "RSD",
  "to": "EUR",
  "rate": 117.25,
  "date": "2026-03-28"
}
```

Rate-Semantik: `1 EUR = {rate} {from}`, also `amountEur = amount / rate`

---

## 5. Validierungslogik

### 5.1 Basisvalidierung (immer)

| Feld       | Regel                                              |
|------------|-----------------------------------------------------|
| date       | Pflicht. Datum, nicht in der Zukunft.                |
| amount     | Pflicht. Zahl > 0, max. 2 Dezimalstellen.           |
| currency   | Pflicht. Gueltiger ISO 4217 Code, Default "EUR".     |
| purposeId  | Pflicht. Muss aktiver Stammdatensatz sein.           |
| categoryId | Pflicht. Muss aktiver Stammdatensatz sein.           |
| userId     | Pflicht. Wird serverseitig aus JWT gesetzt.          |
| file       | Pflicht. Mindestens eine Originaldatei.              |

### 5.2 Optionale Felder

| Feld       | Regel                                              |
|------------|-----------------------------------------------------|
| countryId  | Optional. Wenn gesetzt, muss aktiver Stammdatensatz sein. |
| vehicleId  | Optional. Wenn gesetzt, muss aktiver Stammdatensatz sein. |
| supplier   | Optional. Freitext, max. 255 Zeichen.               |
| remark     | Optional. Freitext, max. 2000 Zeichen.              |

### 5.3 Sonderfall Fremdwaehrung

Wenn `currency != "EUR"`:

| Feld             | Regel                                            |
|------------------|--------------------------------------------------|
| exchangeRate     | Pflicht. Zahl > 0.                               |
| exchangeRateDate | Pflicht. Gueltiges Datum.                        |
| amountEur        | Wird berechnet: `amount / exchangeRate`. Readonly.|

Wenn `currency == "EUR"`:
- `exchangeRate`, `exchangeRateDate` werden auf NULL gesetzt
- `amountEur = amount`

### 5.4 Sonderfall Bewirtung

Wenn Purpose.name == "Bewirtung":

| Feld     | Regel                                                |
|----------|------------------------------------------------------|
| occasion | Pflicht. Freitext, max. 500 Zeichen.                 |
| guests   | Pflicht. Freitext, max. 2000 Zeichen.                |
| location | Pflicht. Freitext, max. 255 Zeichen.                 |

Beim Wechsel des Zwecks weg von "Bewirtung" werden die Hospitality-Daten beibehalten, aber nicht mehr als Pflichtfeld validiert. Beim Wechsel zurueck werden vorhandene Daten wiederhergestellt.

### 5.5 Sonderfall Versand (Statuswechsel OPEN -> READY)

Alle Basisfelder muessen gefuellt sein, zusaetzlich:

| Pruefung                                     | Fehlermeldung                          |
|----------------------------------------------|----------------------------------------|
| countryId muss gesetzt sein                  | "Land ist fuer den Versand erforderlich" |
| SMTP muss konfiguriert sein                  | "SMTP-Einstellungen nicht konfiguriert"|
| DATEV-Adresse muss konfiguriert sein         | "DATEV-Adresse nicht konfiguriert"     |
| Bei Fremdwaehrung: Wechselkurs vorhanden     | "Wechselkurs fehlt"                    |
| Bei Bewirtung: Alle Bewirtungsfelder gefuellt| "Bewirtungsangaben unvollstaendig"     |

---

## 6. Statuslogik

### 6.1 SendStatus-Lebenszyklus

```
                         ┌─────────────────────────┐
                         │                         │
                         ▼                         │
  ┌──────┐  Benutzer  ┌───────┐  System   ┌──────┐│
  │ OPEN ├───────────►│ READY ├──────────►│ SENT ││
  └──────┘  bestaetigt└───┬───┘  Versand   └──┬───┘│
                          │     erfolgreich    │    │
                          │                    │    │
                          │  Versand           │    │
                          │  fehlgeschlagen    │    │
                          ▼                    │    │
                     ┌────────┐                │    │
                     │ FAILED │                │    │
                     └───┬────┘                │    │
                         │                     │    │
                         │  Benutzer:          │    │
                         │  erneut senden      │    │
                         ▼                     │    │
                     ┌───────┐  System         │    │
                     │ RETRY ├────────────────►┘    │
                     └───┬───┘  Versand             │
                         │     erfolgreich          │
                         │                          │
                         │  Versand fehlgeschlagen   │
                         └──────► FAILED             │
                                                    │
                     Benutzer: erneut senden ────────┘
                     (von SENT aus, z.B. fuer Korrektur)
```

### 6.2 Erlaubte Statusuebergaenge

| Von     | Nach   | Ausloeser       | Bedingung                           |
|---------|--------|-----------------|-------------------------------------|
| OPEN    | READY  | Benutzer        | Alle Pflichtfelder gefuellt          |
| READY   | SENT   | System          | E-Mail erfolgreich zugestellt       |
| READY   | FAILED | System          | SMTP-Fehler                         |
| FAILED  | RETRY  | Benutzer        | Explizite Aktion "Erneut senden"    |
| RETRY   | SENT   | System          | E-Mail erfolgreich zugestellt       |
| RETRY   | FAILED | System          | SMTP-Fehler                         |
| SENT    | RETRY  | Benutzer        | Explizite Aktion "Erneut senden"    |
| READY   | OPEN   | Benutzer        | Beleg wird nochmals bearbeitet      |

**Unveraenderliche Regel:** Nur das System darf SENT oder FAILED setzen. Benutzer koennen nur OPEN -> READY, FAILED -> RETRY und SENT -> RETRY ausloesen.

### 6.3 Beleg-Lebenszyklus (uebergeordnet)

```
Fotografieren/Hochladen
    │
    ▼
OCR-Erkennung
    │
    ▼
Manuelle Ergaenzung/Korrektur
    │
    ▼
Speichern (Status: OPEN)
    │
    ▼
Freigabe zum Versand (Status: READY)
    │
    ▼
Automatischer DATEV-Versand per E-Mail
    │
    ├── Erfolg: Status SENT
    │
    └── Fehler: Status FAILED
            │
            ▼
        Erneuter Versand moeglich
```

---

## 7. Drucklogik

### 7.1 Prinzip

Original und Druckansicht sind strikt getrennt:
- **Original:** Unveraendertes Bild/PDF, wie vom Benutzer hochgeladen
- **Druckansicht:** Generiertes DIN-A4-PDF mit Bild + strukturierten Zusatzinformationen

### 7.2 DIN-A4-Layout

```
┌──────────────────────────────────────────┐
│                                          │
│              BELEGBOX                    │ Header
│          Beleg-Nr.: ABC123               │
│                                          │
├──────────────────────────────────────────┤
│                                          │
│                                          │
│                                          │
│           [ Belegbild ]                  │ Bildbereich
│        (max. 50% der Seite,              │ (skaliert,
│         proportional skaliert)           │  zentriert)
│                                          │
│                                          │
├──────────────────────────────────────────┤
│                                          │
│  Datum:        28.03.2026                │
│  Lieferant:    REWE Markt GmbH           │
│  Betrag:       47,50 EUR                 │
│  Kategorie:    Kreditkarte               │
│  Zweck:        Buero                     │ Strukturierte
│  Land:         Deutschland               │ Informationen
│  Kfz:          B-AB 1234                 │
│  Benutzer:     Max Mustermann            │
│  Bemerkung:    Bueromaterial Q1           │
│                                          │
│  ── Versand ──────────────────────────   │
│  Status:       Gesendet                  │
│  Gesendet am:  28.03.2026, 14:32 Uhr    │
│                                          │
├──────────────────────────────────────────┤  ← Nur bei
│                                          │    Fremdwaehrung
│  ── Waehrung ─────────────────────────   │
│  Originalbetrag:  5.862,50 RSD           │
│  Wechselkurs:     1 EUR = 117,25 RSD     │
│  Kursdatum:       28.03.2026             │
│  EUR-Betrag:      50,00 EUR              │
│                                          │
├──────────────────────────────────────────┤  ← Nur bei
│                                          │    Bewirtung
│  ── Bewirtung ────────────────────────   │
│  Anlass:       Projektbesprechung        │
│  Gaeste:       Hr. Mueller, Fr. Schmidt  │
│  Ort:          Restaurant Adria, Berlin  │
│                                          │
├──────────────────────────────────────────┤
│  Erstellt: 28.03.2026 │ BelegBox v1.0    │ Footer
└──────────────────────────────────────────┘
```

### 7.3 Technische Umsetzung

**Bibliothek:** `@react-pdf/renderer`

**Ablauf:**
1. API-Route `/api/receipts/:id/pdf` wird aufgerufen
2. Server laedt Receipt mit allen Relationen aus der Datenbank
3. Server laedt Originalbild aus dem Storage
4. React-PDF-Komponente `ReceiptPrintDocument` wird mit Daten gerendert
5. PDF wird als Stream zurueckgegeben
6. Optional: PDF wird als `PRINT_PDF` ReceiptFile gespeichert (Cache)

**Bildverarbeitung:**
- Bilder werden in das PDF eingebettet (base64)
- Maximale Bildhoehe: 50% der Seitenhoehe
- Proportionale Skalierung, horizontale Zentrierung
- Bei PDF-Originalen: Erste Seite wird als Bild extrahiert

### 7.4 PDF fuer DATEV-Versand

Das per E-Mail an DATEV gesendete Dokument ist das **generierte PDF** (nicht das Original), da es die strukturierten Zusatzinformationen enthaelt. Das Original wird als zusaetzlicher Anhang mitgesendet.

E-Mail-Aufbau:
- Betreff: `Beleg {date} - {supplier} - {amount} {currency}`
- Body: Kurzinfo (Benutzer, Datum, Betrag)
- Anhang 1: Generiertes A4-PDF (Hauptbeleg)
- Anhang 2: Originaldatei

---

## 8. Sicherheits- und Betriebsaspekte

### 8.1 Authentifizierung

**Passwort-Handling:**
- Hashing mit bcrypt (Cost Factor 12)
- Mindestlaenge: 8 Zeichen
- Kein Klartext-Speichern, kein Klartext-Loggen
- Passwort-Reset: Admin setzt neues Passwort (MVP), Self-Service per E-Mail (spaetere Erweiterung)

**PIN-Handling:**
- 4-stellige numerische PIN
- Hashing mit bcrypt (wie Passwort)
- PIN ist optional, wird fuer Kiosk-Modus benoetigt
- PIN-Login liefert denselben JWT wie normaler Login
- Brute-Force-Schutz: 5 Fehlversuche, dann 5 Minuten Sperre

**JWT:**
- Signiert mit HMAC-SHA256 (Secret aus Umgebungsvariable)
- Payload: `{ userId, role, email }`
- Laufzeit: 24 Stunden (konfigurierbar)
- Refresh-Token: nicht im MVP, spaetere Erweiterung

### 8.2 Autorisierung

| Rolle | Darf                                                           |
|-------|----------------------------------------------------------------|
| USER  | Eigene Belege CRUD, eigenes Profil bearbeiten, eigene PIN aendern |
| ADMIN | Alles: Alle Belege, Benutzerverwaltung, Stammdaten, SMTP      |

**Regel:** Jede API-Route prueft `role` aus dem JWT. Beleg-Zugriff prueft zusaetzlich `userId == receipt.userId` (ausser bei ADMIN).

### 8.3 SMTP-Zugangsdaten

- Passwort wird mit AES-256-GCM verschluesselt in der Datenbank gespeichert
- Verschluesselungsschluessel liegt als Umgebungsvariable (`SMTP_ENCRYPTION_KEY`)
- Passwort wird nur serverseitig entschluesselt, nie an den Client gesendet
- GET /api/settings/smtp liefert `password: "********"` (maskiert)

### 8.4 Dateispeicherung

**Verzeichnisstruktur:**
```
/storage/
  receipts/
    {receiptId}/
      original.jpg        (oder .png, .pdf)
      print.pdf           (generiert)
```

**Sicherheit:**
- Storage-Verzeichnis liegt ausserhalb des Web-Roots
- Dateizugriff nur ueber API-Route `/api/files/:id` (authentifiziert)
- Dateinamen werden vom System vergeben (kein User-Input in Pfaden)
- MIME-Type-Validierung beim Upload: nur `image/jpeg`, `image/png`, `application/pdf`
- Maximale Dateigroesse: 20 MB

### 8.5 Logging und Audit

**AuditLog erfasst:**
- Beleg erstellt, bearbeitet, geloescht
- Versand ausgeloest, Versand erfolgreich, Versand fehlgeschlagen
- Benutzer angelegt, bearbeitet, deaktiviert
- Login (erfolgreich und fehlgeschlagen)
- SMTP-Konfiguration geaendert
- Stammdaten geaendert

**Audit-Eintrag enthaelt:**
- Wer (userId)
- Was (action + entity + entityId)
- Wann (createdAt)
- Details (vorher/nachher als JSON, ohne sensitive Daten)

**Application Logging:**
- Strukturiertes Logging (JSON) auf stdout
- Log-Level: ERROR, WARN, INFO, DEBUG
- Keine sensitiven Daten in Logs (Passwoerter, PINs, SMTP-Credentials)

### 8.6 Umgebungsvariablen

```env
# Datenbank
DATABASE_URL=postgresql://user:pass@localhost:5432/belegbox

# Auth
NEXTAUTH_SECRET=<random-64-chars>
NEXTAUTH_URL=http://localhost:3000

# SMTP-Verschluesselung
SMTP_ENCRYPTION_KEY=<random-32-byte-hex>

# Storage
STORAGE_PATH=/storage

# OCR
OCR_LANGUAGE=deu+eng

# Initialer Admin
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=<initial-password>

# Wechselkurs-API
EXCHANGE_RATE_API_URL=https://api.frankfurter.app
```

---

## 9. MVP-Umsetzung in Phasen

### Phase 1: Fundament (Kern-Erfassung)

**Ziel:** Belege fotografieren, strukturieren und speichern.

| Komponente                  | Umfang                                              |
|-----------------------------|------------------------------------------------------|
| Projektsetup                | Next.js, TypeScript, Tailwind, Prisma, PostgreSQL    |
| Datenbank                   | Vollstaendiges Schema, Migrationen, Seed-Daten       |
| Auth                        | Login mit E-Mail + Passwort, JWT, Rollen             |
| Belegerfassung              | Kamera, Upload, Formular mit allen Feldern           |
| OCR                         | Tesseract.js serverseitig, Extraktion Datum/Betrag   |
| Stammdaten                  | CRUD fuer Vehicle, Purpose, Category, Country        |
| Belegliste                  | Liste, Detailansicht, Bearbeitung                    |
| Storage                     | Lokales Dateisystem, Upload/Download                 |
| UI                          | Responsive Layout, Hell/Dunkel-Modus                 |
| Benutzerverwaltung          | Admin: Benutzer CRUD                                 |

**Ergebnis Phase 1:** Belege koennen erfasst, bearbeitet und durchsucht werden.

### Phase 2: Versand & Druck

**Ziel:** Belege an DATEV senden und als PDF drucken.

| Komponente                  | Umfang                                              |
|-----------------------------|------------------------------------------------------|
| SMTP-Konfiguration          | Admin-Screen, verschluesselte Speicherung            |
| DATEV-Versand               | E-Mail mit PDF + Original als Anhang                 |
| Statuslogik                 | Vollstaendiger SendStatus-Lebenszyklus               |
| Versandprotokoll            | SendLog, Historie in Beleg-Detail                    |
| PDF-Generierung             | DIN-A4-Layout mit @react-pdf                         |
| Waehrungslogik              | Wechselkurs-API, Berechnung, Anzeige                |
| Bewirtungslogik             | Zusatzfelder, bedingte Validierung                   |
| Druckansicht                | PDF-Vorschau und Download                            |

**Ergebnis Phase 2:** Vollstaendiger Workflow von Erfassung bis DATEV-Versand.

### Phase 3: Komfort & Betrieb

**Ziel:** Produktionsreife, Kiosk-Modus, erweiterte Suche.

| Komponente                  | Umfang                                              |
|-----------------------------|------------------------------------------------------|
| PIN-Login / Kiosk           | 4-stellige PIN, Brute-Force-Schutz                  |
| Erweiterte Suche            | Volltextsuche, erweiterte Filter, Paginierung        |
| Bulk-Aktionen               | Mehrere Belege gleichzeitig senden                   |
| Audit-Log                   | Vollstaendiges Protokoll aller Aenderungen           |
| Dashboard                   | Statistik, Status-Uebersicht                        |
| Performance                 | Bildkompression, Lazy Loading, Caching               |
| Error Handling              | Globale Fehlerbehandlung, User-Feedback              |
| Deployment                  | Docker-Compose, Produktionskonfiguration             |

**Ergebnis Phase 3:** Produktionsreife App mit allen spezifizierten Features.

### Spaetere Erweiterungen (nach MVP)

- S3-kompatibler Storage (MinIO / AWS)
- Cloud-OCR-Provider (Google Vision, Azure) als Alternative
- Export-Funktionen (CSV, DATEV-Format)
- Multi-Mandanten-Faehigkeit
- Passwort-Reset per E-Mail
- Refresh-Tokens
- 2FA
- Offline-Modus (PWA mit Service Worker)
- Push-Benachrichtigungen bei Versandstatus-Aenderung
- Automatische Belegkategorisierung per ML

---

## 10. Offene Entscheidungen / Risiken

### 10.1 Frueh festzulegen

| Entscheidung                                | Empfehlung                                      | Grund                                    |
|---------------------------------------------|--------------------------------------------------|------------------------------------------|
| Hosting-Umgebung                            | Docker auf eigenem Server oder VPS               | Bestimmt Storage-Strategie und Deployment |
| Domain und HTTPS                            | Frueh einrichten                                  | Kamera-API benoetigt HTTPS               |
| PostgreSQL-Version und Hosting              | Managed DB oder Docker-Container                  | Backup-Strategie abhaengig davon         |
| OCR-Sprache                                 | Deutsch + Englisch als Standard                   | Bestimmt Tesseract-Sprachpakete          |
| Waehrungsliste                              | ISO 4217 Subset oder freie Eingabe?               | Empfehlung: feste Liste der gaengigen    |
| Bewirtungs-Erkennung                        | Per Purpose.name == "Bewirtung" (String-Match)    | Alternativ: Flag am Purpose-Stammdatensatz |
| DATEV-E-Mail-Format                         | Genau klaeren, was DATEV erwartet                 | Betreff-Format, Anhang-Format, ggf. XML  |

### 10.2 Risiken

| Risiko                                      | Schwere | Mitigation                                      |
|---------------------------------------------|---------|-------------------------------------------------|
| OCR-Qualitaet bei Handykamera-Bildern       | Mittel  | Bildqualitaets-Hinweis, manuelle Korrektur       |
| DATEV akzeptiert E-Mail-Format nicht        | Hoch    | Format frueh mit DATEV/Steuerberater abstimmen   |
| Wechselkurs-API nicht verfuegbar            | Niedrig | Manuelle Eingabe als Fallback, Caching           |
| Datenverlust bei lokalem Storage            | Hoch    | Backup-Strategie frueh definieren                |
| PIN-Brute-Force im Kiosk-Modus             | Mittel  | Rate-Limiting, Account-Sperre nach Fehlversuchen |
| Grosse Bilddateien (>10MB)                 | Niedrig | Serverseitige Kompression nach Upload            |

### 10.3 Spaeter erweiterbar halten

| Aspekt                         | Vorbereitung im MVP                                      |
|--------------------------------|-----------------------------------------------------------|
| Storage-Provider               | Interface `StorageProvider` mit `save()`, `get()`, `delete()` |
| OCR-Provider                   | Interface `OcrProvider` mit `analyze()`                   |
| Multi-Mandanten                | `tenantId` kann spaeter zu allen Tabellen hinzugefuegt werden |
| Weitere Versandkanaele         | SendLog ist generisch genug fuer andere Kanaele           |
| Export-Formate                 | Receipt-Datenmodell ist vollstaendig genug fuer beliebige Exporte |
| Mehrsprachigkeit               | Texte nicht hart codieren, i18n-Bibliothek spaeter einfuehrbar |

---

## Anhang A: Projektstruktur

```
belegbox/
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── layout.tsx                # Root Layout (Theme, Auth)
│   │   ├── page.tsx                  # Redirect zu /receipts
│   │   ├── login/
│   │   │   └── page.tsx              # Login-Screen
│   │   ├── receipts/
│   │   │   ├── page.tsx              # Belegliste [M02/D03]
│   │   │   ├── new/
│   │   │   │   └── page.tsx          # Neuer Beleg [M03 + M04]
│   │   │   └── [id]/
│   │   │       ├── page.tsx          # Beleg-Detail [M05/D04]
│   │   │       ├── edit/
│   │   │       │   └── page.tsx      # Beleg bearbeiten
│   │   │       └── print/
│   │   │           └── page.tsx      # Druckvorschau [D05]
│   │   ├── admin/
│   │   │   ├── layout.tsx            # Admin-Layout mit Sidebar
│   │   │   ├── dashboard/
│   │   │   │   └── page.tsx          # Dashboard [D02]
│   │   │   ├── users/
│   │   │   │   └── page.tsx          # Benutzerverwaltung [D06]
│   │   │   ├── master-data/
│   │   │   │   └── page.tsx          # Stammdaten [D07]
│   │   │   └── settings/
│   │   │       └── page.tsx          # SMTP-Einstellungen [D08]
│   │   └── settings/
│   │       └── page.tsx              # Benutzer-Einstellungen [M06]
│   ├── api/                          # API Routes
│   │   ├── auth/
│   │   │   └── [...nextauth]/
│   │   │       └── route.ts
│   │   ├── receipts/
│   │   │   ├── route.ts              # GET (Liste), POST (Erstellen)
│   │   │   └── [id]/
│   │   │       ├── route.ts          # GET, PUT, DELETE
│   │   │       ├── send/route.ts
│   │   │       ├── retry/route.ts
│   │   │       ├── pdf/route.ts
│   │   │       └── send-log/route.ts
│   │   ├── ocr/
│   │   │   └── analyze/route.ts
│   │   ├── files/
│   │   │   ├── upload/route.ts
│   │   │   └── [id]/route.ts
│   │   ├── master/
│   │   │   ├── vehicles/route.ts
│   │   │   ├── purposes/route.ts
│   │   │   ├── categories/route.ts
│   │   │   └── countries/route.ts
│   │   ├── users/
│   │   │   └── route.ts
│   │   ├── settings/
│   │   │   └── smtp/route.ts
│   │   └── exchange-rate/route.ts
│   ├── components/
│   │   ├── ui/                       # Basis-UI-Komponenten
│   │   ├── receipts/                 # Beleg-spezifische Komponenten
│   │   ├── admin/                    # Admin-spezifische Komponenten
│   │   └── layout/                   # Layout-Komponenten
│   ├── lib/
│   │   ├── auth.ts                   # NextAuth-Konfiguration
│   │   ├── prisma.ts                 # Prisma-Client Singleton
│   │   ├── storage.ts                # Storage-Provider Interface + Implementierung
│   │   ├── ocr.ts                    # OCR-Provider Interface + Tesseract
│   │   ├── mail.ts                   # Mail-Service (Nodemailer)
│   │   ├── pdf.ts                    # PDF-Generator (@react-pdf)
│   │   ├── exchange-rate.ts          # Wechselkurs-Service
│   │   ├── encryption.ts            # AES-256-GCM fuer SMTP-Passwort
│   │   └── validation.ts            # Zod-Schemas fuer alle Entitaeten
│   ├── hooks/                        # React Custom Hooks
│   └── types/                        # Geteilte TypeScript-Typen
├── storage/                          # Datei-Storage (nicht im Git)
├── public/
├── .env.local
├── .env.example
├── docker-compose.yml
├── Dockerfile
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

## Anhang B: Bewirtungserkennung

Die Erkennung, ob ein Beleg ein Bewirtungsbeleg ist, erfolgt ueber den Zweck-Stammdatensatz. Empfehlung: Ein Boolean-Flag `isHospitality` auf dem `Purpose`-Modell statt String-Matching.

```prisma
model Purpose {
  // ... bestehende Felder
  isHospitality Boolean @default(false)  // Steuert Bewirtungslogik
}
```

Vorteil: Umbenennungen des Zwecks ("Bewirtung" -> "Geschaeftsessen") brechen die Logik nicht. Nachteil: Ein Feld mehr. Der Vorteil ueberwiegt klar -- **empfohlene Loesung**.

## Anhang C: Wechselkurs-Berechnung

**Konvention:** `exchangeRate` speichert "1 EUR = X Fremdwaehrung" (EZB-Standard).

**Berechnung:**
```
amountEur = amount / exchangeRate
```

**Beispiel:**
- Beleg: 11.725,00 RSD
- Kurs: 1 EUR = 117,25 RSD
- EUR-Betrag: 11.725,00 / 117,25 = 100,00 EUR

**Rundung:** Kaufmaennisch auf 2 Dezimalstellen (HALF_UP).

**API-Abruf:**
```
GET https://api.frankfurter.app/2026-03-28?from=EUR&to=RSD
Response: { "rates": { "RSD": 117.25 } }
```

Fallback bei API-Ausfall: Manueller Kurs-Eintrag durch Benutzer.
