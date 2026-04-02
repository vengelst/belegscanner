# BelegBox -- Smart Capture Ausbaukonzept

Version: Konzept v1
Stand: 2026-04-02
Basis: BelegBox 1.2.0

---

## Gesamtziel

Die mobile Belegerfassung wird von "Datei hochladen → OCR → Formular" zu einem intelligenten Kamera-Flow erweitert: Kamera oeffnen, Beleg im Bild erkennen, automatisch ausloesen, Bild verbessern, OCR ausfuehren, Felder intelligent zuordnen, unsichere Werte markieren, Nutzer bestaetigt und speichert.

Bestehendes System bleibt vollstaendig erhalten. Smart Capture ist ein neuer Frontend-Flow, der in die bestehende Receipt-Erstellung und OCR-Pipeline muendet.

---

## Architektur-Uebersicht

```
┌──────────────────────────────────────────────────────────────┐
│                    Mobiles Frontend                           │
│                                                              │
│  ┌─────────┐   ┌──────────┐   ┌──────────┐   ┌───────────┐ │
│  │ Camera  │──►│ Document │──►│  Image   │──►│  Review   │ │
│  │ Preview │   │ Detector │   │ Processor│   │  + Form   │ │
│  │         │   │(optional)│   │          │   │           │ │
│  └─────────┘   └──────────┘   └──────────┘   └─────┬─────┘ │
│       │                            │                │       │
│   getUserMedia              Canvas API         bestehender  │
│   (Browser)                 (Client)           Receipt-Flow │
└───────────────────────────────┼──────────────────────┼──────┘
                                │                      │
                    ┌───────────▼───────────┐   ┌──────▼──────┐
                    │    POST /api/ocr/     │   │ POST /api/  │
                    │    smart-analyze      │   │  receipts   │
                    │                       │   │             │
                    │  1. Bildoptimierung   │   │ bestehend   │
                    │  2. OCR (Tesseract)   │   │             │
                    │  3. Receipt Parser    │   │             │
                    │  4. Klassifikation    │   │             │
                    │  5. Feld-Extraktion   │   │             │
                    │  6. Confidence-Score  │   │             │
                    └───────────────────────┘   └─────────────┘
```

**Kernprinzip:** Das Frontend ist fuer Kamera und Vorschau zustaendig. Alles Rechenintensive (OCR, Parsing, Klassifikation) laeuft serverseitig. Die bestehende Receipt-Erstellung und der Versand-Flow bleiben unveraendert.

---

## 1. Mobile Kameraerfassung

### Was im Browser realistisch funktioniert

Die MediaStream API (`navigator.mediaDevices.getUserMedia`) funktioniert in allen modernen mobilen Browsern (Safari iOS, Chrome Android) unter HTTPS. Das ist ausreichend fuer einen soliden Kamera-Flow.

**Gut machbar im Browser:**
- Live-Kamera-Preview (Video-Element)
- Manuelle Foto-Aufnahme per Button (Canvas-Snapshot)
- Wechsel Front-/Rueckkamera
- Torch/Blitz-Steuerung (Chrome Android, nicht Safari)
- Bildaufloesung bis zur nativen Kamera-Aufloesung

**Eingeschraenkt im Browser:**
- Autofokus-Steuerung (begrenzte API, geraeteabhaengig)
- Frame-by-Frame-Analyse fuer Auto-Capture (Performance-intensiv)
- Zugriff auf RAW-Sensor-Daten (nicht moeglich)

**Nicht machbar im Browser:**
- Hintergrundkamera / Scan-Modus wenn App nicht im Vordergrund
- Native Kamera-App-Integration

**Empfehlung:** Browserbasiert starten. Das reicht fuer 90% der Faelle. PWA/Hybrid erst erwaegen, wenn Auto-Capture-Performance zum Problem wird.

### Technische Umsetzung

Neue Client-Komponente: `src/components/receipts/camera-capture.tsx`

```typescript
// Kern-API-Nutzung
const stream = await navigator.mediaDevices.getUserMedia({
  video: {
    facingMode: { ideal: "environment" },  // Rueckkamera
    width: { ideal: 2048 },                // Hohe Aufloesung fuer OCR
    height: { ideal: 2048 },
  },
});
```

**Flow:**
1. User oeffnet `/receipts/new` → Button "Kamera" neben Datei-Upload
2. Kamera-Overlay oeffnet (Vollbild-Modal auf Mobile)
3. Live-Preview mit Hilfsrahmen ("Beleg hier platzieren")
4. Manueller Ausloese-Button (gross, touchfreundlich)
5. Nach Aufnahme: Vorschau mit "Verwenden" / "Wiederholen"
6. Bei "Verwenden": Bild wird an Server geschickt, OCR startet, Formular oeffnet

**HTTPS-Hinweis:** Kamera-API erfordert HTTPS. Im lokalen Dev geht `localhost` (Ausnahme). Fuer Staging/Produktion ist HTTPS Pflicht (bereits in Go-Live-Docs dokumentiert).

### Was NICHT in Phase 1 gebaut wird
- Auto-Capture (kommt in Phase B)
- Dokumentenerkennung im Video-Stream (kommt in Phase B)
- Multi-Page-Capture (mehrere Seiten eines Belegs)

---

## 2. Dokumentenerkennung / Auto-Capture

### Architektur-Entscheidung: Client-seitig

Dokumentenerkennung muss im Video-Stream laufen (30fps Analyse). Das ist nur client-seitig sinnvoll -- serverseitige Frame-Analyse waere zu langsam (Netzwerk-Roundtrip).

### Optionen

| Ansatz | Bibliothek | Groesse | Qualitaet | Browser-Support |
|---|---|---|---|---|
| **OpenCV.js** (WASM) | opencv.js | ~8 MB | Sehr gut | Alle modernen | 
| **Eigene Canvas-Heuristik** | Keine | 0 KB | Ausreichend | Alle |
| **TensorFlow.js Modell** | @tensorflow/tfjs | ~3 MB | Gut | Alle modernen |

**Empfehlung: Eigene Canvas-Heuristik zuerst, OpenCV.js spaeter.**

Phase B startet mit einer leichtgewichtigen Eigenimplementierung:

```typescript
// Pseudocode: Einfache Dokumentenerkennung per Canvas
function detectDocument(videoFrame: ImageData): DocumentBounds | null {
  // 1. Graustufenkonvertierung
  // 2. Canny-Edge-Detection (vereinfacht)
  // 3. Konturfindung (groesstes Rechteck)
  // 4. Pruefung: Mindestgroesse, Seitenverhaeltnis A4-aehnlich
  // 5. Perspektiv-Schaetzung
  return bounds; // { topLeft, topRight, bottomLeft, bottomRight }
}
```

### Auto-Capture-Kriterien

| Kriterium | Messung | Schwellwert |
|---|---|---|
| Dokument vollstaendig im Bild | Alle 4 Ecken innerhalb Viewport | Ja |
| Schaerfe ausreichend | Laplacian-Varianz auf Dokument-Region | > 100 (empirisch) |
| Perspektive brauchbar | Winkelabweichung von Rechteck | < 15 Grad |
| Stabilitaet | Dokument-Position stabil ueber 500ms | Ja |
| Helligkeit | Mittlere Helligkeit im Dokument-Bereich | 40-220 (nicht zu dunkel, nicht ueberbelichtet) |

**Visuelles Feedback:**
- Hilfsrahmen zeigt gruen wenn alle Kriterien erfuellt
- Countdown (0.5s) vor Auto-Ausloesen -- Nutzer kann abbrechen
- Bei schlechten Bedingungen: Hinweis ("Mehr Licht", "Naeher ran", "Stillhalten")

### Wann manuell statt automatisch

- Zerknitterte / gefaltete Belege (Kontur nicht erkennbar)
- Sehr kleine Belege (Parkscheine, Muenzkassenbelege)
- Belege auf gemustertem Untergrund
- Schlechte Lichtverhaeltnisse

→ Auto-Capture ist immer optional. Manueller Button bleibt immer verfuegbar.

---

## 3. Bildvorverarbeitung

### Pipeline (serverseitig)

Die Bildvorverarbeitung laeuft auf dem Server als Teil der neuen `/api/ocr/smart-analyze`-Route, BEVOR Tesseract.js ausgefuehrt wird.

**Bibliothek: `sharp`** (bereits Standard fuer Node.js Bildverarbeitung, WASM-basiert, schnell)

```
Originalbild (Kamera-Capture)
    │
    ▼
[1] Rotation korrigieren (EXIF-Orientation)     ← Pflicht
    │
    ▼
[2] Perspektivkorrektur (wenn Bounds vorhanden)  ← Wenn verfuegbar
    │
    ▼
[3] Zuschnitt auf Dokument-Region                ← Wenn verfuegbar
    │
    ▼
[4] Skalierung auf OCR-optimale Groesse          ← Pflicht (300 DPI Aequivalent)
    │
    ▼
[5] Kontrast / Schaerfe verbessern               ← Pflicht
    │
    ▼
[6] Graustufen fuer OCR                          ← Pflicht
    │
    ▼
  Verarbeitetes Bild → Tesseract.js
```

### Schritt-Details

| Schritt | Pflicht | Tool | Beschreibung |
|---|---|---|---|
| EXIF-Rotation | Ja | sharp `.rotate()` | Handy-Bilder sind oft physisch gedreht |
| Perspektivkorrektur | Optional | sharp + Transformation | Nur wenn Frontend Dokument-Bounds mitschickt |
| Zuschnitt | Optional | sharp `.extract()` | Entfernt Hintergrund um Beleg |
| Skalierung | Ja | sharp `.resize()` | Breite 2400px (OCR-optimal) |
| Kontrast | Ja | sharp `.normalize().sharpen()` | Verbessert OCR-Genauigkeit deutlich |
| Graustufen | Ja | sharp `.grayscale()` | Tesseract arbeitet besser mit Graustufen |

### Trennung Original / Verarbeitet

```
storage/
  receipts/{id}/
    original.jpg          ← Unveraendert (wie bisher)
    processed.jpg         ← Optimiert fuer OCR (temporaer, nicht persistent)
```

Das verarbeitete Bild wird NUR fuer OCR verwendet und NICHT gespeichert. Das Original bleibt immer erhalten (bestehende Regel). Wenn der Nutzer spaeter die Datei ansieht, sieht er das Original.

---

## 4. OCR-Pipeline

### Bestehende Pipeline (bleibt erhalten)

```
analyzeDocument(buffer, mimeType)
  ├── Image → recognizeImageText(buffer) → buildResult()
  └── PDF → analyzePdf(buffer)
              ├── Text-Extraktion (pdf-parse)
              └── Scan-Fallback (Seitenbild → recognizeImageText)
```

### Erweiterte Pipeline (Smart Capture)

```
analyzeSmartCapture(buffer, documentBounds?)
  │
  ├── [1] Bildvorverarbeitung (sharp)
  │        → processedBuffer
  │
  ├── [2] OCR (Tesseract.js, bestehendes recognizeImageText)
  │        → rawText, confidence
  │
  ├── [3] Strukturierte Textanalyse (NEU)
  │        → Zeilen, Bloecke, Positionen
  │
  ├── [4] Belegklassifikation (NEU)
  │        → receiptType: "fuel" | "hospitality" | "hotel" | "parking" | "general"
  │
  ├── [5] Feldbezogene Extraktion (ERWEITERT)
  │        → Alle erkannten Felder mit Confidence
  │
  └── [6] Nachverarbeitung / Plausibilitaet
           → Bereinigte Werte, Kreuzvalidierung
```

### Neue OCR-Ergebnis-Datenstruktur

```typescript
// src/lib/ocr/types.ts

export type SmartCaptureResult = {
  // Bestehende OcrResult-Felder (rueckwaertskompatibel)
  sourceType: OcrSourceType;
  rawText: string;
  confidence: number;
  message: string | null;

  // Belegklassifikation
  receiptType: ReceiptType;
  receiptTypeConfidence: OcrFieldConfidenceLevel;

  // Erweiterte Feld-Extraktion
  fields: ExtractedFields;

  // Structured line items (fuer Bewirtung / detaillierte Belege)
  lineItems: ExtractedLineItem[];
};

export type ReceiptType =
  | "general"       // Allgemeiner Kassenbon
  | "fuel"          // Tankbeleg
  | "hospitality"   // Bewirtung / Restaurant
  | "hotel"         // Unterkunft
  | "parking"       // Parken
  | "toll"          // Maut
  | "transport"     // Bahn / Flug / Taxi
  | "unknown";

export type ExtractedField<T> = {
  value: T | null;
  confidence: OcrFieldConfidenceLevel;
  source: "ocr" | "rule" | "cross-validated";
  rawMatch?: string;  // Der Originaltextausschnitt
};

export type ExtractedFields = {
  // Kern (bestehend, erweitert)
  date: ExtractedField<string>;
  amount: ExtractedField<number>;
  currency: ExtractedField<string>;
  supplier: ExtractedField<string>;

  // Neu: Allgemein
  location: ExtractedField<string>;
  country: ExtractedField<string>;       // ISO-Code
  taxId: ExtractedField<string>;         // USt-IdNr
  taxAmount: ExtractedField<number>;     // MwSt-Betrag
  netAmount: ExtractedField<number>;     // Netto
  paymentMethod: ExtractedField<PaymentMethod>;
  cardLastDigits: ExtractedField<string>;

  // Neu: Tankbeleg-spezifisch
  fuelLiters: ExtractedField<number>;
  fuelPricePerLiter: ExtractedField<number>;
  fuelType: ExtractedField<string>;

  // Neu: Bewirtung-spezifisch (Kopfdaten)
  guestCount: ExtractedField<number>;
  tipAmount: ExtractedField<number>;
};

export type PaymentMethod = "cash" | "credit_card" | "debit_card" | "unknown";

export type ExtractedLineItem = {
  description: string;
  quantity: number | null;
  unitPrice: number | null;
  totalPrice: number | null;
  confidence: OcrFieldConfidenceLevel;
};
```

### Rueckwaertskompatibilitaet

Die bestehende `OcrResult`-Schnittstelle bleibt erhalten. `SmartCaptureResult` ist eine Obermenge. Die bestehende `/api/ocr/analyze`-Route aendert sich nicht. Smart Capture nutzt eine neue Route `/api/ocr/smart-analyze`.

---

## 5. Receipt-Intelligence / Belegklassifikation

### Keyword-basierte Klassifikation

```typescript
// src/lib/ocr/receipt-classifier.ts

const CLASSIFICATION_RULES: Array<{
  type: ReceiptType;
  keywords: RegExp;
  weight: number;
}> = [
  // Tankbelege
  { type: "fuel", keywords: /tank|zapf|liter|diesel|super|benzin|e[- ]?10|unleaded|fuel/i, weight: 3 },
  { type: "fuel", keywords: /aral|shell|esso|jet|total|agip|bp|avia|star|orlen/i, weight: 5 },
  { type: "fuel", keywords: /\d+[.,]\d+\s*l\b/i, weight: 4 },  // "45,23 l"

  // Bewirtung
  { type: "hospitality", keywords: /restaurant|gasthaus|cafe|bistro|pizzeria|trattoria|bar\b|gastronomie/i, weight: 4 },
  { type: "hospitality", keywords: /speisen|getraenke|kellner|tisch|bedienung|trinkgeld/i, weight: 3 },
  { type: "hospitality", keywords: /bewirtung/i, weight: 5 },

  // Hotel
  { type: "hotel", keywords: /hotel|pension|gasthof|motel|hostel|resort|zimmer|uebernachtung/i, weight: 4 },
  { type: "hotel", keywords: /check.?in|check.?out|nacht|night|room/i, weight: 3 },
  { type: "hotel", keywords: /ibis|mercure|hilton|marriott|holiday inn|novotel|accor/i, weight: 5 },

  // Parken
  { type: "parking", keywords: /park|garage|parkhaus|parkschein|parkgebuehr|stellplatz/i, weight: 4 },
  { type: "parking", keywords: /einfahrt|ausfahrt|dauer|parkzeit/i, weight: 3 },

  // Maut
  { type: "toll", keywords: /maut|toll|vignette|putarina|autoput|gebuehr/i, weight: 4 },

  // Transport
  { type: "transport", keywords: /fahrkarte|ticket|bahn|zug|flug|taxi|uber|bolt|boarding/i, weight: 3 },
];
```

**Algorithmus:**
1. Alle Keywords gegen rawText pruefen
2. Gewichte pro Typ summieren
3. Typ mit hoechster Summe gewinnt
4. Confidence:
   - Summe > 10: "high"
   - Summe 5-10: "medium"
   - Summe < 5: "low"
   - Kein Match: "unknown" mit "none"

### Warum keine ML-Klassifikation

Ein trainiertes Modell waere genauer, aber:
- Kein Trainingsdata-Set vorhanden
- Deployment-Komplexitaet (ONNX/TFLite im Server)
- Keyword-Regeln decken 85-90% der Praxis-Faelle ab
- Regeln sind wartbar und nachvollziehbar

ML kann spaeter als Verbesserung nachgeruestet werden, ohne die Architektur zu aendern (der Classifier ist ein austauschbares Modul).

---

## 6. Feldbezogene Extraktion

### Erkennungs-Zuverlaessigkeit nach Feld

| Feld | Automatisch sicher | Unsicher / Vorschlag | Immer bestaetigen |
|---|---|---|---|
| Datum | Bei Keyword-Kontext | Ohne Keyword | -- |
| Gesamtbetrag | Bei "Summe"/"Total"-Zeile | Groesster Betrag | -- |
| Waehrung | Bei explizitem Code/Symbol | Bei Sprach-Heuristik | Bei Fremdwaehrung |
| Lieferant | Bei bekanntem Muster | Erste Zeile | -- |
| MwSt-Betrag | Bei "MwSt"/"USt"-Zeile | -- | -- |
| Zahlungsart | Bei klarem Keyword | -- | Bei Kartendaten |
| Kartenendziffern | Bei "****1234"-Muster | -- | **Immer** |
| Land | Bei Waehrung+Adresse | -- | Bei Fremdwaehrung |
| Liter (Tank) | Bei "XX,XX l"-Muster | -- | -- |
| Preis/Liter | Bei EUR/l-Muster | -- | -- |
| Einzelpositionen | -- | -- | **Immer** |

### Zahlungsart-Erkennung

```typescript
// Typische OCR-Muster
const PAYMENT_PATTERNS = {
  credit_card: /(?:visa|mastercard|master\s*card|amex|american\s*express|kreditkarte|credit)/i,
  debit_card: /(?:ec[- ]?karte|giro[- ]?card|maestro|debit|v\s*pay|bankkarte)/i,
  cash: /(?:bar(?:zahlung)?|bargeld|wechselgeld|gegeben|zurueck)/i,
};

const CARD_DIGITS = /\*{2,}\s*(\d{4})\b|\bx{2,}\s*(\d{4})\b|\d{4}\s*\*{4}\s*\*{4}\s*(\d{4})/i;
```

**Wichtig zu Kartenendziffern:**
- Werden NUR extrahiert, NIE automatisch ins Formular uebernommen
- Immer als "zur Pruefung" markiert
- Keine Speicherung vollstaendiger Kartennummern (Datenschutz)
- Nur letzte 4 Ziffern, und nur wenn klar als maskierte Nummer erkennbar

### Laendererkennung

```typescript
const COUNTRY_INDICATORS = {
  // Waehrung → Land (Primaer-Indikator)
  currency: { CHF: "CH", RSD: "RS", MKD: "MK", HRK: "HR", CZK: "CZ", HUF: "HU" },
  // EUR-Laender brauchen weitere Hinweise:
  vatPrefix: { DE: /DE\s?\d{9}/, AT: /ATU\d{8}/, IT: /IT\d{11}/ },
  phonePrefix: { DE: /\+49|0049/, AT: /\+43|0043/, CH: /\+41|0041/, RS: /\+381/ },
  postalCode: { DE: /\b\d{5}\b/, AT: /\b\d{4}\b/, CH: /\b\d{4}\b/ },
};
```

**Regeln:**
- Nicht-EUR-Waehrung erkannt → Land automatisch setzen (confidence: high)
- EUR + USt-IdNr-Praefix erkannt → Land setzen (confidence: high)
- EUR + Telefon-Vorwahl → Land vorschlagen (confidence: medium)
- EUR + nur Postleitzahl → Land vorschlagen (confidence: low)
- Nichts erkannt → Land leer lassen, User waehlt

---

## 7. Vertrauenswert / Unsicherheitsmodell

### Feld-Status-Modell

Jedes extrahierte Feld hat einen von fuenf Status:

```typescript
type FieldStatus =
  | "auto_high"        // OCR sicher erkannt, darf ohne Pruefung uebernommen werden
  | "auto_low"         // OCR unsicher, muss vom Nutzer geprueft werden
  | "not_detected"     // OCR hat nichts gefunden, Nutzer muss eingeben
  | "user_confirmed"   // Nutzer hat OCR-Vorschlag bestaetigt
  | "user_override";   // Nutzer hat OCR-Vorschlag ueberschrieben
```

### Kritische Felder (duerfen nie still ueberschrieben werden)

| Feld | Grund |
|---|---|
| Betrag | Finanziell relevant, Fehler hat direkte Auswirkung |
| Waehrung bei Fremdwaehrung | Falsche Waehrung → falscher EUR-Betrag |
| Kartenendziffern | Datenschutz, nur mit Bestaetigung speichern |
| Bewirtungs-Gaeste | Steuerlich relevant, darf nicht geraten werden |

### Visualisierung im UI

```
┌─────────────────────────────────────────┐
│  Betrag        47,50 EUR    ✓ sicher    │  ← Gruener Haken
│  Datum         28.03.2026   ⚠ pruefen  │  ← Gelbes Dreieck
│  Lieferant     ARAL         ✓ sicher    │
│  Zahlungsart   EC-Karte     ⚠ pruefen  │
│  Karte ****1234             🔒 bestaetigen│ ← Schloss
│  Zweck         [Tanken ▼]   💡 Vorschlag │ ← Gluehbirne
│  Land          [  ▼  ]      ❌ eingeben  │  ← Rot, leer
└─────────────────────────────────────────┘
```

---

## 8. Nutzerbestaetigung / Korrekturlogik

### Mobiler Smart-Capture-Flow

```
[1] Kamera        →  Foto aufnehmen oder Auto-Capture
         │
         ▼
[2] Vorschau       →  "Verwenden" / "Wiederholen"
         │
         ▼
[3] Analyse        →  Ladebildschirm "Beleg wird analysiert..."
         │                (Serverseitig: Vorverarbeitung + OCR + Parsing)
         ▼
[4] Smart Review   →  Erkannte Werte anzeigen
         │                Unsichere Felder markiert
         │                Belegtyp vorgeschlagen
         │                Fehlende Pflichtfelder hervorgehoben
         │
         ▼
[5] Korrektur      →  Nutzer korrigiert/bestaetigt
         │                Dropdowns fuer Stammdaten (Zweck, Kategorie, Land, Kfz)
         │                Toggle fuer Bewirtungsfelder
         │                Waehrung/Wechselkurs bei Fremdwaehrung
         │
         ▼
[6] Speichern      →  "Speichern" / "Speichern & Senden" / "Speichern & Naechster"
```

### Design-Prinzipien

1. **OCR darf manuelle Eingaben nie ueberschreiben.** Sobald ein Nutzer ein Feld manuell geaendert hat, wird es als `user_override` markiert und kein OCR-Update mehr angewendet.

2. **Wenig Klicks, viel Kontrolle.** Sichere Felder sind vorausgefuellt und bestaetigt. Nur unsichere/fehlende Felder brauchen Interaktion.

3. **Progressive Disclosure.** Basisfelder (Datum, Betrag, Waehrung, Zweck, Kategorie) immer sichtbar. Tankbeleg-Details, Bewirtungsdetails, Kartendaten nur bei erkanntem Belegtyp einblenden.

4. **"Speichern & Naechster" als Standard-Aktion** fuer schnelle Serienerfassung.

---

## 9. Datenmodell-Erweiterungen

### Phase 1 (Smart Capture MVP)

Keine Schema-Aenderung noetig. Die bestehenden Receipt-Felder reichen:
- `supplier`, `amount`, `currency`, `date` → bestehend
- `ocrRawText` → bestehend
- `countryId`, `vehicleId`, `purposeId`, `categoryId` → bestehend

Die erweiterten OCR-Ergebnisse (Confidence, Belegtyp, Tankdaten) werden NICHT persistent im Receipt gespeichert, sondern nur waehrend der Erfassung im Frontend gehalten. Grund: Die Werte fliessen in die bestehenden Felder ein, der OCR-Rohtext ist archiviert, die Zwischen-Analyse ist transient.

### Phase 2 (wenn persistent noetig)

Erst wenn Auswertungen ueber OCR-Qualitaet oder Belegtypen gebraucht werden:

```prisma
// Erweiterung am Receipt (optional, erst Phase 2)
model Receipt {
  // ... bestehend ...
  detectedReceiptType   String?              // "fuel", "hospitality", etc.
  captureSource         String?              // "camera", "upload", "email"
  ocrAnalysis           Json?                // Vollstaendiges SmartCaptureResult als JSON
}
```

### Phase 3 (Tankbeleg-Details persistent)

Erst wenn Tankbelege separat ausgewertet werden sollen:

```prisma
model FuelDetail {
  id              String   @id @default(cuid())
  receiptId       String   @unique
  receipt         Receipt  @relation(fields: [receiptId], references: [id], onDelete: Cascade)
  liters          Decimal? @db.Decimal(8, 3)
  pricePerLiter   Decimal? @db.Decimal(8, 4)
  fuelType        String?
  createdAt       DateTime @default(now())
}
```

**Bewirtungsdetails:** Bereits als `Hospitality`-Modell vorhanden. Kein neues Modell noetig -- Smart Capture fuellt die bestehenden Felder (`occasion`, `guests`, `location`) vor.

---

## 10. API-Erweiterungen

### Neue Route

```
POST /api/ocr/smart-analyze
```

**Request:** `multipart/form-data`
- `file`: Bild-Datei (JPEG/PNG)
- `documentBounds`: Optional, JSON-String mit 4 Eckpunkten vom Frontend-Detector

**Response:** `SmartCaptureResult` (siehe Abschnitt 4)

### Bestehende Routen (unveraendert)

| Route | Aenderung |
|---|---|
| `POST /api/ocr/analyze` | Bleibt fuer Standard-Upload (Datei-Upload ohne Kamera) |
| `POST /api/receipts` | Keine Aenderung, empfaengt weiterhin Feld-Werte |
| `POST /api/files/upload` | Keine Aenderung, speichert Original |

### Dateifluss bei Smart Capture

```
1. Kamera-Bild (JPEG, ~2-5 MB)
   │
   ├──► POST /api/ocr/smart-analyze
   │    → Vorverarbeitung → OCR → SmartCaptureResult
   │    → Response an Frontend (kein Speichern)
   │
   ├──► POST /api/receipts (Metadaten aus Formular)
   │    → Receipt erstellt
   │
   └──► POST /api/files/upload (Originalbild)
        → Original gespeichert als ReceiptFile
```

---

## 11. UI-Aenderungen

### Neue Komponenten

| Komponente | Zweck | Phase |
|---|---|---|
| `camera-capture.tsx` | Kamera-Preview, Foto-Aufnahme | A |
| `smart-review-form.tsx` | Erweiterte Erfassungsmaske mit Confidence-Anzeige | C |
| `receipt-type-badge.tsx` | Belegtyp-Anzeige mit Icon | D |
| `fuel-detail-fields.tsx` | Tankbeleg-Zusatzfelder | E |
| `line-items-display.tsx` | Einzelpositionen-Anzeige | E |

### Bestehende Komponenten (erweitert)

| Komponente | Aenderung | Phase |
|---|---|---|
| `receipt-form.tsx` | "Kamera"-Button neben Datei-Upload | A |
| `receipt-form.tsx` | Belegtyp-Vorschlag als Chip ueber Formular | D |

### Mobiler Flow-Screen

```
┌────────────────────────────┐
│  ← Zurueck     BelegBox   │
│                            │
│  ┌──────────────────────┐  │
│  │                      │  │
│  │   [Kamera-Preview]   │  │
│  │                      │  │
│  │   ┌──────────────┐   │  │
│  │   │ Beleg hier   │   │  │
│  │   │ platzieren   │   │  │
│  │   └──────────────┘   │  │
│  │                      │  │
│  └──────────────────────┘  │
│                            │
│      [ 📷 Aufnehmen ]     │
│                            │
│  oder: Datei waehlen       │
└────────────────────────────┘
```

---

## 12. Umsetzungsphasen

### Phase A: Kamera + manuelle Aufnahme

**Ziel:** Kamera-Button auf Mobile, Foto aufnehmen, an bestehende OCR-Pipeline senden.
**Nutzen:** Kein Umweg ueber Foto-App und Galerie-Upload mehr.
**Aenderungen:**
- `camera-capture.tsx` (neu): getUserMedia, Video-Preview, Canvas-Snapshot
- `receipt-form.tsx`: "Kamera"-Button integrieren, Bild an `/api/ocr/analyze` senden
- Keine API-Aenderung, keine Schema-Aenderung
**Risiko:** Niedrig. Standard-Browser-APIs, keine neue Dependency.
**Abhaengigkeiten:** HTTPS in Staging/Produktion.

### Phase B: Bildvorverarbeitung + (optionaler) Auto-Capture

**Ziel:** Bessere OCR-Ergebnisse durch vorverarbeitete Bilder.
**Nutzen:** Deutlich hoehere Erkennungsrate bei Handy-Fotos.
**Aenderungen:**
- `sharp` als neue Dependency
- `src/lib/ocr/image-processor.ts` (neu): Rotation, Skalierung, Kontrast, Graustufen
- `POST /api/ocr/smart-analyze` (neu): Vorverarbeitung + bestehende OCR
- Optional: Einfache Dokument-Erkennung im Frontend (Canvas-basiert)
**Risiko:** Mittel. `sharp` funktioniert gut auf Node.js, WASM-Build in Docker muss getestet werden.
**Abhaengigkeiten:** Phase A.

### Phase C: Erweiterte Feld-Extraktion + Confidence

**Ziel:** Mehr Felder erkennen, Sicherheit pro Feld anzeigen.
**Nutzen:** Weniger manuelle Eingaben, bessere Datenqualitaet.
**Aenderungen:**
- `src/lib/ocr/field-extractor.ts` (neu): Erweiterte Extraktion (Land, Zahlungsart, Steuer, etc.)
- `src/lib/ocr/types.ts` (neu): `SmartCaptureResult`, `ExtractedFields`
- `smart-review-form.tsx` (neu): Confidence-Visualisierung
- Bestehende OCR-Parsing-Funktionen werden in das neue Modul migriert
**Risiko:** Mittel. Parsing-Heuristiken brauchen Testdaten fuer verschiedene Belegformate.
**Abhaengigkeiten:** Phase B.

### Phase D: Belegklassifikation

**Ziel:** Automatisch erkennen ob Tank-, Bewirtungs-, Hotel-Beleg etc.
**Nutzen:** Zweck wird vorgeschlagen, Bewirtungsfelder automatisch eingeblendet.
**Aenderungen:**
- `src/lib/ocr/receipt-classifier.ts` (neu): Keyword-basierte Klassifikation
- `receipt-form.tsx`: Belegtyp-Chip, Zweck-Vorschlag
**Risiko:** Niedrig. Keyword-Regeln sind simpel und wartbar.
**Abhaengigkeiten:** Phase C (nutzt erweiterte Extraktion).

### Phase E: Spezialparser (Tank + Bewirtung)

**Ziel:** Tankbeleg-Details (Liter, Preis/l, Kraftstoff) und Bewirtungs-Positionen erkennen.
**Nutzen:** Noch weniger Tipparbeit bei den haeufigsten Belegtypen.
**Aenderungen:**
- `src/lib/ocr/parsers/fuel-parser.ts` (neu)
- `src/lib/ocr/parsers/hospitality-parser.ts` (neu)
- `fuel-detail-fields.tsx`, `line-items-display.tsx` (neu)
- Optional: `FuelDetail`-Modell in Prisma (erst wenn Auswertung gewuenscht)
**Risiko:** Mittel. Tankbeleg-Formate variieren stark nach Land/Anbieter.
**Abhaengigkeiten:** Phase D.

### Phase F: Auto-Capture mit Dokumentenerkennung

**Ziel:** Kamera erkennt Beleg und loest automatisch aus.
**Nutzen:** Hands-free-Erfassung, schnellster moeglicher Capture.
**Aenderungen:**
- `src/components/receipts/document-detector.ts` (neu): Canvas-basierte Konturanalyse
- `camera-capture.tsx` erweitern: Overlay, Auto-Trigger-Logik
- Optional: OpenCV.js fuer bessere Erkennung
**Risiko:** Hoch. Performance auf aelteren Mobilgeraeten, Browser-Unterschiede, Fehlausloesung.
**Abhaengigkeiten:** Phase A. Kann unabhaengig von C/D/E gebaut werden.

---

## 13. Risiken und Stolperstellen

### Browsergrenzen

| Thema | Risiko | Mitigation |
|---|---|---|
| getUserMedia ohne HTTPS | Blockierend | HTTPS ist bereits Pflicht fuer Produktion |
| Torch/Blitz nicht in Safari | Einschraenkung | Fallback: kein Blitz, Hinweis bei schlechtem Licht |
| Autofokus-Steuerung | Begrenzt | Manuelle Aufnahme mit Hinweis "Stillhalten" |
| Video-Frame-Analyse Performance | Mittel | Auto-Capture optional, nicht fuer Phase 1 |
| WASM (OpenCV) in Safari | Moeglich problematisch | Eigene Canvas-Heuristik als Fallback |

### OCR-Fehlerrisiken

| Thema | Risiko | Mitigation |
|---|---|---|
| Falsche Betraege | Hoch | Betrag ist immer "zur Pruefung" markiert wenn < high |
| Verwechslung Netto/Brutto | Mittel | "Summe/Gesamt"-Keyword-Erkennung priorisiert Brutto |
| Falsches Datum (Uhrzeit als Datum) | Mittel | Datumsvalidierung: nicht in der Zukunft, nicht >1 Jahr alt |
| Falscher Lieferant | Niedrig | Nur Vorschlag, Nutzer bestaetigt |

### Datenschutz

| Thema | Regelung |
|---|---|
| Kamera-Zugriff | Browser zeigt Berechtigungs-Dialog, User muss zustimmen |
| Kartenendziffern | Nur letzte 4 Ziffern, nur mit expliziter Bestaetigung speichern |
| Kamerabilder | Nur das finale Bild wird gespeichert (als Original), kein Video-Stream-Recording |
| Serveruebertragung | Bild wird per HTTPS uebertragen, nicht lokal im Browser gespeichert |

### Performance auf Mobilgeraeten

| Schritt | Wo | Dauer (geschaetzt) |
|---|---|---|
| Kamera-Aufnahme | Client | Instant |
| Bild-Upload (5 MB) | Netzwerk | 1-3s (LTE) |
| Bildvorverarbeitung (sharp) | Server | 0.3-1s |
| Tesseract OCR | Server | 2-5s |
| Parsing + Klassifikation | Server | < 0.1s |
| **Gesamt** | | **3-9s** |

→ Ladeindikator mit Fortschritt ist Pflicht ("Bild hochladen... OCR laeuft... Felder werden erkannt...")

---

## 14. Priorisierung

### Sofort bauen (Phase A)

- Kamera-Button auf Mobile in `receipt-form.tsx`
- `camera-capture.tsx` mit getUserMedia
- Canvas-Snapshot als JPEG
- Bild direkt an bestehende `/api/ocr/analyze` senden
- **Aufwand:** ~1 Paket, keine neue Dependency, keine Schema-Aenderung
- **Impact:** Sofort nutzbar, kein Umweg ueber Foto-App

### Direkt danach (Phase B + C)

- `sharp` installieren
- Bildvorverarbeitung serverseitig
- Erweiterte Feld-Extraktion (Zahlungsart, Land, Steuer)
- Confidence-Anzeige im Formular
- `/api/ocr/smart-analyze` als neue Route
- **Aufwand:** ~2 Pakete, eine neue Dependency
- **Impact:** Deutlich bessere OCR-Ergebnisse, weniger manuelle Eingaben

### Danach (Phase D + E)

- Belegklassifikation (Keyword-basiert)
- Zweck-Vorschlag basierend auf Belegtyp
- Tankbeleg-Parser (Liter, Preis/l, Kraftstoff)
- Bewirtungs-Positionsparser
- **Aufwand:** ~2 Pakete, keine neue Dependency
- **Impact:** Spezialisierte Erkennung fuer haeufigste Belegtypen

### Optional spaeter (Phase F)

- Auto-Capture mit Dokumentenerkennung
- OpenCV.js oder TensorFlow.js
- Perspektivkorrektur im Frontend
- **Aufwand:** ~2 Pakete, moeglicherweise grosse WASM-Dependency
- **Impact:** Komfort-Feature, nicht essentiell

### Explizit NICHT bauen

- Eigenes ML-Modell fuer Belegklassifikation (Keyword-Regeln reichen)
- Vollstaendige Positionserfassung fuer alle Belegtypen (nur Tank + Bewirtung)
- Offline-OCR im Browser (Tesseract WASM ist zu gross und zu langsam)
- Native App / React Native Wrapper (Browser reicht)
- Speicherung des gesamten SmartCaptureResult in der DB (nur Final-Werte speichern)

---

## 15. Konkrete Codex-Auftraege nach Freigabe

Nach Freigabe dieses Konzepts sollte Codex folgende Pakete umsetzen:

**Paket SC-1: Kamera-Integration (Phase A)**
- `camera-capture.tsx` mit getUserMedia + Canvas
- Integration in `receipt-form.tsx` als alternativer Erfassungsweg
- HTTPS-Pruefung: Kamera-Button nur bei HTTPS anzeigen

**Paket SC-2: Server-seitige Bildoptimierung (Phase B)**
- `npm install sharp`
- `src/lib/ocr/image-processor.ts`
- `POST /api/ocr/smart-analyze` mit Vorverarbeitung vor Tesseract

**Paket SC-3: Erweiterte Extraktion + Confidence UI (Phase C)**
- `src/lib/ocr/types.ts`, `src/lib/ocr/field-extractor.ts`
- Zahlungsart, Land, Steuer, Kartenendziffern
- `smart-review-form.tsx` mit Confidence-Visualisierung

**Paket SC-4: Belegklassifikation + Spezialparser (Phase D + E)**
- `src/lib/ocr/receipt-classifier.ts`
- `src/lib/ocr/parsers/fuel-parser.ts`
- `src/lib/ocr/parsers/hospitality-parser.ts`
- Zweck-Vorschlag, Tank-/Bewirtungs-Zusatzfelder
