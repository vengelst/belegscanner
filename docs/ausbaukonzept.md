# BelegBox -- Ausbaukonzept Phase 2+

Version: 1.2.0 Basis
Stand: 2026-04-02

---

## Gesamtstrategie

Ausbau in 6 priorisierten Paketen. Jedes Paket ist einzeln umsetzbar, aufeinander aufbauend aber nicht zwingend sequentiell. Kein Paket erfordert Neubau bestehender Komponenten -- nur gezielte Erweiterungen.

**Leitprinzipien:**
- Bestehende Architektur (Next.js 15 / Prisma / Tailwind) beibehalten
- Bestehende Services erweitern, nicht ersetzen
- Datenmodell minimal erweitern, keine Parallelmodelle
- UI-Erweiterungen in bestehende Layouts integrieren

---

## Paket A: Benutzer-Defaults und Schnellerfassung

**Ziel:** Belege unterwegs in 10 Sekunden statt 30 erfassen.
**Fachlicher Nutzen:** Groesster Alltagshebel -- reduziert Tipparbeit bei jeder Erfassung.
**Prioritaet:** SOFORT

### Datenmodell

```prisma
// Erweiterung am User-Modell (keine neue Tabelle)
model User {
  // ... bestehende Felder ...
  defaultCountryId    String?
  defaultVehicleId    String?
  defaultPurposeId    String?
  defaultCategoryId   String?
  defaultDatevProfileId String?
  defaultCurrency     String?   @db.VarChar(3)
}
```

Kein separates Preferences-Modell -- die Anzahl der Defaults ist ueberschaubar (6 Felder), eine eigene Tabelle waere Overengineering.

### Schnellvorlagen (optional, zweiter Schritt)

```prisma
model QuickTemplate {
  id          String   @id @default(cuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id])
  name        String                      // z.B. "Tanken DE"
  countryId   String?
  vehicleId   String?
  purposeId   String?
  categoryId  String?
  currency    String?  @db.VarChar(3)
  sortOrder   Int      @default(0)
  createdAt   DateTime @default(now())

  @@index([userId, sortOrder])
}
```

### API-Aenderungen

| Route | Aenderung |
|---|---|
| `PUT /api/users/me/defaults` | Neue Route: eigene Defaults setzen |
| `GET /api/auth/me` | Defaults im Response mitliefern |
| `GET /api/receipts/new` (Page) | Defaults laden, in Form vorbelegen |
| `POST /api/templates` | CRUD fuer Schnellvorlagen (optional) |

### UI-Aenderungen

| Stelle | Aenderung |
|---|---|
| `/settings` | Abschnitt "Meine Standardwerte" mit Dropdown-Feldern |
| `/receipts/new` | Formularfelder mit User-Defaults vorbelegt (statt leer) |
| `/receipts/new` | Button "Speichern & naechster Beleg" (resettet Formular, behaelt Datei-Input offen) |
| `/receipts/new` | Optionaler Vorlagen-Chip-Bereich ueber dem Formular |

### Implementierungshinweise

- Defaults sind **Vorschlaege**, keine Pflicht -- der Nutzer kann jedes Feld aendern
- "Speichern & naechster Beleg" setzt Formularfelder auf Defaults zurueck, loescht Datei-State
- Vorlagen-Chips: Klick auf "Tanken DE" befuellt Zweck=Tanken, Land=DE, Kfz=Standard-Kfz
- Kein localStorage/Cookie-Ansatz -- alles serverseitig in der DB, dadurch geraeteuebergreifend

### Risiken

- Defaults koennen veralten, wenn Stammdaten deaktiviert werden
- Loesung: Beim Laden pruefen ob referenzierte IDs noch aktiv sind, sonst ignorieren

---

## Paket B: OCR-Verbesserung und Regelengine

**Ziel:** OCR trifft oefter, Regelvorschlaege sparen weiteres Tippen.
**Fachlicher Nutzen:** Weniger manuelle Korrekturen, weniger Fehler.
**Prioritaet:** SOFORT (zusammen mit Paket A)

### OCR-Parser erweitern

Die bestehende `src/lib/ocr.ts` hat bereits eine saubere Architektur mit `FieldResult<T>` und Confidence-Levels. Erweiterungen:

**Neue Extraktionsfelder:**
```typescript
export type OcrResult = {
  rawText: string;
  extracted: {
    date: string | null;
    amount: number | null;
    currency: string | null;
    supplier: string | null;
    // NEU:
    taxId: string | null;        // USt-IdNr. / Steuernummer
    receiptNumber: string | null; // Belegnummer / Rechnungsnummer
    taxAmount: number | null;     // MwSt-Betrag
    netAmount: number | null;     // Netto-Betrag
  };
  confidence: number;
  fieldConfidence: { /* ... bestehend + neue Felder ... */ };
  // NEU:
  suggestedPurpose: string | null; // Vorschlag basierend auf Haendler-Keywords
};
```

**Haendler-Kategorisierung (Regelengine):**
```typescript
// src/lib/ocr-rules.ts -- NEUES Modul
const SUPPLIER_PATTERNS: Array<{ pattern: RegExp; purpose: string }> = [
  { pattern: /tank|aral|shell|esso|jet|total|agip/i, purpose: "Tanken" },
  { pattern: /hotel|gasthof|pension|motel|ibis|mercure|hilton/i, purpose: "Unterkunft" },
  { pattern: /restaurant|gasthaus|cafe|bistro|pizzeria|trattoria/i, purpose: "Bewirtung" },
  { pattern: /maut|putarina|autoput|toll|vignette/i, purpose: "Maut" },
  { pattern: /park|garage|parkhaus/i, purpose: "Parken" },
  { pattern: /baumarkt|obi|hornbach|bauhaus/i, purpose: "Material" },
  { pattern: /rewe|edeka|aldi|lidl|penny|netto|kaufland/i, purpose: "Buero" },
];

export function suggestPurpose(supplier: string | null, rawText: string): string | null {
  const searchText = `${supplier ?? ""} ${rawText}`.toLowerCase();
  for (const rule of SUPPLIER_PATTERNS) {
    if (rule.pattern.test(searchText)) return rule.purpose;
  }
  return null;
}
```

**Land-Waehrungs-Regeln:**
```typescript
// src/lib/ocr-rules.ts
const COUNTRY_CURRENCY_MAP: Record<string, string> = {
  DE: "EUR", AT: "EUR", CH: "CHF", RS: "RSD", MK: "MKD", HR: "EUR",
};

export function suggestCurrencyForCountry(countryCode: string): string | null {
  return COUNTRY_CURRENCY_MAP[countryCode] ?? null;
}
```

### UI: Unsichere Felder kennzeichnen

```tsx
// In receipt-form.tsx: Feldrahmen basierend auf Confidence
const confidenceClass = {
  high: "border-primary/40",      // Gruen-Ton: sicher erkannt
  medium: "border-accent/40",     // Gelb-Ton: pruefen empfohlen
  low: "border-danger/40",        // Rot-Ton: sehr unsicher
  none: "border-border",          // Standard: nicht erkannt
};
```

Jedes Formularfeld bekommt einen kleinen Indikator:
- Gruener Punkt: OCR sicher
- Gelber Punkt + "(pruefen)": OCR unsicher
- Kein Punkt: Manuell ausgefuellt

### Risiken

- Zu viele Regeln fuehren zu falschen Vorschlaegen die den Nutzer nerven
- Loesung: Regeln sind immer nur Vorschlaege, nie harte Werte, Nutzer behaelt Kontrolle
- OCR-Keywords koennen bei unbekannten Haendlern nicht greifen
- Loesung: Fallback auf bestehende Logik (Zweck bleibt leer, Nutzer waehlt)

---

## Paket C: Sammelaktionen und Batch-Verarbeitung

**Ziel:** Admin kann 20 Belege auf einmal freigeben, senden oder exportieren.
**Fachlicher Nutzen:** Drastische Zeitersparnis bei Monatsabschluessen.
**Prioritaet:** DANACH (nach A+B, da weniger dringend als Erfassungskomfort)

### API

Neue Route: `POST /api/receipts/batch`

```typescript
// Request
{
  action: "approve" | "send" | "retry" | "export-pdf" | "assign-profile",
  receiptIds: string[],
  datevProfileId?: string  // fuer assign-profile
}

// Response
{
  total: number,
  succeeded: number,
  failed: number,
  errors: Array<{ receiptId: string; error: string }>
}
```

**Teilfehler-Strategie:** Best-Effort. Jeder Beleg wird einzeln verarbeitet, Fehler werden gesammelt, die anderen laufen weiter. Response enthaelt Erfolgs- und Fehlerliste.

### Erlaubte Aktionen nach Rolle

| Aktion | USER | ADMIN |
|---|---|---|
| approve (Freigeben) | Nein | Ja |
| send (Senden) | Eigene, nur APPROVED | Ja |
| retry (Erneut senden) | Eigene FAILED | Ja |
| export-pdf (Sammel-PDF) | Eigene | Ja |
| assign-profile | Nein | Ja |

### UI: Mehrfachauswahl in der Belegliste

- Checkboxen links an jedem Beleg (Mobile: Swipe oder Long-Press)
- Sticky-Footer mit Aktions-Buttons erscheint bei Auswahl
- "X Belege ausgewaehlt" Zaehler
- Admin sieht mehr Aktionen als User
- "Alle auf dieser Seite" Schnellauswahl

### Risiken

- Massenversand kann SMTP-Rate-Limits triggern
- Loesung: Sequentielle Verarbeitung mit kurzer Pause (nicht parallel)
- Massenfreigabe ohne Pruefung gefaehrlich
- Loesung: Bestaetigungsdialog mit Zaehler ("20 Belege freigeben?")

---

## Paket D: Benachrichtigungen (In-App)

**Ziel:** Nutzer sieht sofort, wenn etwas Aufmerksamkeit braucht.
**Fachlicher Nutzen:** Keine Belege vergessen, keine Fehler uebersehen.
**Prioritaet:** DANACH (nach A+B+C)

### Datenmodell

```prisma
model Notification {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  type      String                        // SEND_FAILED, INCOMPLETE, REVIEW_NEEDED, etc.
  severity  String   @default("info")     // info, warning, error
  title     String
  message   String
  receiptId String?                       // Optional: Bezug zu einem Beleg
  read      Boolean  @default(false)
  createdAt DateTime @default(now())

  @@index([userId, read, createdAt])
}
```

### Benachrichtigungs-Typen

| Typ | Trigger | Severity | Empfaenger |
|---|---|---|---|
| SEND_FAILED | Versand fehlgeschlagen | error | Beleg-Owner + Admin |
| INCOMPLETE | Beleg > 3 Tage DRAFT ohne Pflichtfelder | warning | Beleg-Owner |
| REVIEW_NEEDED | Beleg IN_REVIEW | info | Admins |
| REVIEW_DONE | Beleg APPROVED/DEFERRED | info | Beleg-Owner |
| HOSPITALITY_MISSING | Bewirtungszweck aber keine Daten | warning | Beleg-Owner |
| SMTP_DOWN | SMTP-Test fehlgeschlagen | error | Admins |
| CONFIG_MISSING | Kein DATEV-Profil / kein SMTP | warning | Admins |

### UI-Integration

- **Badge am Header:** Glocken-Icon mit Zaehler (ungelesene Notifications)
- **Dropdown/Flyout:** Letzte 10 Notifications, "Alle anzeigen" Link
- **Notification-Seite:** `/notifications` mit vollstaendiger Liste
- **Auto-Generierung:** Notifications werden von den bestehenden Services erzeugt (Mail-Service bei FAILED, Review-Route bei Status-Wechsel)
- **Keine E-Mail:** Erstmal nur In-App. E-Mail-Benachrichtigungen als spaetere Erweiterung.

### Risiken

- Zu viele Notifications nerven
- Loesung: Max 1 Notification pro Beleg + Typ (Deduplizierung), Auto-Archivierung nach 30 Tagen

---

## Paket E: Verbesserter Druck und Archiv

**Ziel:** Monatsabschluss als Sammel-PDF, Archivansicht mit Vorschau.
**Fachlicher Nutzen:** Steuerberater bekommt ein sauberes Paket, nicht 50 Einzel-Mails.
**Prioritaet:** OPTIONAL SPAETER

### Sammel-PDF

Neue API-Route: `GET /api/receipts/batch-pdf?ids=a,b,c` oder `POST /api/receipts/batch-pdf`

Aufbau:
1. **Deckblatt:** Zeitraum, Anzahl, Gesamtsumme, Benutzer
2. **Pro Beleg:** Bestehende A4-Druckseite (wiederverwendet `src/lib/pdf.ts`)
3. **Optional: Zusammenfassungsseite** am Ende

Technisch: `@react-pdf/renderer` kann mehrseitige Dokumente. Bestehende `buildReceiptDocument()` wird pro Beleg aufgerufen und in ein `Document` mit mehreren Pages zusammengefasst.

### Archivansicht

Neue Seite: `/receipts/archive`
- Monats-/Jahresgruppierung
- Thumbnail-Vorschau (erstes Bild des Belegs, verkleinert)
- Quick-Actions: Drucken, PDF, Detail
- Filter nach gesendet/geprüft/freigegeben

### Risiken

- Sammel-PDF mit 100 Belegen kann gross werden (100+ MB bei Bildern)
- Loesung: Limit auf 50 Belege pro PDF, Bilder auf 1024px skalieren

---

## Paket F: Erweiterte Exporte und Reporting

**Ziel:** Daten fuer Steuerberater, Buchhaltung und interne Auswertung bereitstellen.
**Fachlicher Nutzen:** Kein manuelles Zusammensuchen mehr.
**Prioritaet:** OPTIONAL SPAETER

### Export-Erweiterungen

Bestehender CSV-Export (`/api/receipts/export`) wird erweitert um:

- **Spezialexporte als URL-Parameter:** `?subset=hospitality` (nur Bewirtung), `?subset=failed` (nur fehlgeschlagen), `?subset=foreign` (nur Fremdwaehrung)
- **Zusaetzliche Spalten:** Pruefstatus, DATEV-Profil, Bewirtungsdaten (Anlass/Gaeste/Ort), OCR-Konfidenz
- **DATEV-kompatibles Format:** Separater Endpunkt `GET /api/receipts/export/datev` mit DATEV-Buchungsstapel-Format (Festlayout, Semikolon, spezifische Spaltenreihenfolge)

### Reporting-Erweiterungen

Bestehende `/api/reports/summary` wird erweitert:

- **Neue Dimensionen:** Bewirtungsbelege separat, Fremdwaehrungsbelege separat, nach Kfz, nach DATEV-Profil
- **Trendansicht:** Belege pro Monat (letzte 12 Monate) als einfaches Balkendiagramm
- **Keine Chart-Library:** Reine CSS/HTML-Balken (proportionale `div`-Breiten), kein Chart.js/Recharts

### Risiken

- DATEV-Format ist komplex und muss mit Steuerberater abgestimmt werden
- Loesung: Erst Standard-CSV, DATEV-Format nur nach Abstimmung

---

## Datenmodell-Zusammenfassung

Alle Schema-Erweiterungen auf einen Blick:

```prisma
// === User-Erweiterung (Paket A) ===
model User {
  // + Defaults
  defaultCountryId      String?
  defaultVehicleId      String?
  defaultPurposeId      String?
  defaultCategoryId     String?
  defaultDatevProfileId String?
  defaultCurrency       String?   @db.VarChar(3)
  // + Relationen
  notifications         Notification[]
  quickTemplates        QuickTemplate[]
}

// === Neue Modelle ===

model QuickTemplate {           // Paket A (optional)
  id          String   @id @default(cuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id])
  name        String
  countryId   String?
  vehicleId   String?
  purposeId   String?
  categoryId  String?
  currency    String?  @db.VarChar(3)
  sortOrder   Int      @default(0)
  createdAt   DateTime @default(now())
  @@index([userId, sortOrder])
}

model Notification {            // Paket D
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  type      String
  severity  String   @default("info")
  title     String
  message   String
  receiptId String?
  read      Boolean  @default(false)
  createdAt DateTime @default(now())
  @@index([userId, read, createdAt])
}
```

---

## API-Zusammenfassung

| Route | Paket | Methode | Zweck |
|---|---|---|---|
| `PUT /api/users/me/defaults` | A | PUT | Eigene Defaults setzen |
| `GET/POST /api/templates` | A | CRUD | Schnellvorlagen verwalten |
| `POST /api/receipts/batch` | C | POST | Sammelaktionen |
| `GET /api/notifications` | D | GET | Eigene Notifications |
| `PUT /api/notifications/:id/read` | D | PUT | Als gelesen markieren |
| `POST /api/notifications/read-all` | D | POST | Alle als gelesen |
| `GET /api/receipts/batch-pdf` | E | GET | Sammel-PDF |
| `GET /api/receipts/export/datev` | F | GET | DATEV-Format-Export |

---

## Risiken und Stolperstellen

| Risiko | Wahrscheinlichkeit | Auswirkung | Mitigation |
|---|---|---|---|
| OCR-Regeln liefern falsche Vorschlaege | Mittel | Niedrig | Nur Vorschlaege, keine harten Werte |
| User-Defaults zeigen auf deaktivierte Stammdaten | Niedrig | Niedrig | Beim Laden pruefen, ungueltige ignorieren |
| Massenversand triggert SMTP-Rate-Limits | Mittel | Mittel | Sequentielle Verarbeitung, Pausen |
| Sammel-PDF zu gross | Niedrig | Mittel | 50-Beleg-Limit, Bild-Skalierung |
| Notification-Spam | Mittel | Niedrig | Deduplizierung pro Beleg+Typ |
| DATEV-Format inkompatibel | Hoch | Hoch | Format frueh mit Steuerberater abstimmen |

---

## Prioritaetenliste

### Sofort sinnvoll (groesster Alltagshebel)

1. **Benutzer-Defaults** (Paket A Kern) -- 6 Default-Felder am User, vorbelegen im Formular
2. **"Speichern & naechster Beleg"** (Paket A) -- ein Button, maximale Beschleunigung
3. **OCR-Regelengine** (Paket B) -- Haendler-Keywords -> Zweck-Vorschlaege
4. **Land-Waehrungs-Automatik** (Paket B) -- Serbien -> RSD vorschlagen
5. **OCR-Konfidenz im UI** (Paket B) -- farbliche Kennzeichnung unsicherer Felder

### Danach sinnvoll (naechste Iteration)

6. **Sammelaktionen** (Paket C) -- Mehrfachauswahl + Batch-Freigabe/-Versand
7. **In-App-Benachrichtigungen** (Paket D) -- Badge + Notification-Liste
8. **Schnellvorlagen** (Paket A optional) -- "Tanken DE" als 1-Klick-Vorlage
9. **Export-Erweiterung** (Paket F Teilmenge) -- Bewirtungs-/Fremdwaehrungs-Teilexport

### Optional spaeter (wenn Alltag es verlangt)

10. **Sammel-PDF mit Deckblatt** (Paket E)
11. **Archivansicht mit Thumbnails** (Paket E)
12. **Monats-Trendchart im Reporting** (Paket F)
13. **E-Mail-Benachrichtigungen** (Paket D Erweiterung)
14. **DATEV-Buchungsstapel-Format** (Paket F) -- erst nach Abstimmung mit Steuerberater

### Lieber nicht / erst sehr spaet

- **Chart-Bibliothek** (Recharts, Chart.js) -- CSS-Balken reichen, keine weitere Dependency
- **Offline/PWA** -- Komplexitaet vs. Nutzen zu schlecht
- **Echtzeit-Notifications** (WebSocket) -- Polling oder Page-Refresh genuegt
- **ML-Kategorisierung** -- Regelengine deckt 90% der Faelle ab
- **Multi-Mandant** -- Architektur-Grossumbau ohne aktuellen Bedarf
