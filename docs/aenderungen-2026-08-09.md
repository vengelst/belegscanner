# Aenderungen 2026-08-09 – Belegerfassung, Liste, KI-Overlay

Stand: 2026-08-09  
Produktion: `vivahome.de` / `/opt/belegscanner` (nach Deploy der genannten Commits)

Dieses Dokument haelt die in der Session umgesetzten Aenderungen fest.

---

## 1. Speichern vs. Speichern & Uebertragen

### Semantik

| Aktion | Bedeutung | Ergebnis |
|---|---|---|
| **Speichern** | Beleg im System ablegen | Offen, nacharbeitbar (`sendStatus: OPEN`, Review bleibt entwurfsnah) |
| **Speichern & naechsten Beleg erfassen** | Speichern + leeres Formular | Wie Speichern, dann Folgeerfassung |
| **Speichern & Uebertragen** | Speichern + DATEV-Versand | Bei Erfolg geschlossen (`sendStatus: SENT`, `reviewStatus: COMPLETED`) |

### UI / Code

- Formularhinweis und Button-Label: „Speichern & Uebertragen“ (statt „Senden“)
- Detailansicht: „Jetzt uebertragen“ / „Erneut uebertragen“
- Nach erfolgreichem Versand setzt `sendReceipt` in `src/lib/mail.ts` zusaetzlich `reviewStatus: COMPLETED`
- Testbereich / bestehende Testwege wurden nicht entfernt

---

## 2. Belegliste: Filter merken, Reset, Mehrfachaktion

### Filter-Persistenz

- Die Listen-Query (Filter, Sortierung, Seite) wird in `sessionStorage` unter `belegscanner.receiptListQuery` gehalten (`src/lib/receipts/list-query.ts`)
- „Zurueck zur Liste“ auf der Belegdetailseite (`ReceiptsBackLink`) oeffnet wieder die gefilterte Ansicht

### Filter zuruecksetzen

- Sichtbarer Button **Filter zuruecksetzen** in der Filterleiste (auch ohne aufgeklapptes Panel), sobald Filter/Suche aktiv sind

### Mehrfachauswahl

- Checkboxen in Mobile- und Desktop-Liste
- Bei Auswahl: **Freigeben** (Admin), **Uebertragen**, Auswahl aufheben
- Ablauf clientseitig ueber bestehende APIs:
  - Freigabe: `PUT /api/receipts/[id]/review` mit `{ action: "approve" }`
  - Uebertragen: `POST /api/receipts/[id]/send`
- Teilfehler werden gemeldet; erfolgreiche Belege zaehlen separat

---

## 3. KI-Overlay waehrend der Erkennung

### Verhalten

- Grosses Vollbild-Overlay **nur** waehrend `ocrRunning` (KI-Analyse)
- **Nicht** waehrend der Bildvorbereitung / Crop-Vorbereitung
- Verschwindet, sobald die Analyse fertig ist (Erfolg oder Fehler)

### Design

- Gewaehlt: **Option C** – animierter Progress-Ring mit fallendem Sand
- Komponente: `src/components/receipts/ai-analysis-overlay.tsx`
- Styles: `.ai-ring*` in `src/app/globals.css`
- Design-Entwuerfe A–D (Standbilder) liegen unter `docs/sanduhr-vorschlaege/` (lokal, Auswahlhilfe)

---

## 4. Weitere Fixes derselben Session (Kontext)

Nicht Teil der drei Freigabe-Punkte, aber mit ausgeliefert bzw. zuvor gepusht:

| Thema | Kurzbeschreibung |
|---|---|
| Crop-Griffe | Gruene Ecken vergroessert (sichtbar/Hit-Area), leichter greifbar |
| Auto-Capture | Loest aus, sobald Belegrahmen erkannt; Default „Normal“; kein strikter Ready-Zwang mehr |
| Formular-Submit | Betrag/Lieferant u. a. aus React-State statt nur FormData; manuelle Werte auch in OCR-Struktur |
| API-Validierung | Ungueltige `aiStructuredData` blockiert Speichern nicht mehr, wenn Kernfelder ok sind |

---

## 5. Relevante Commits (Auszug)

- `fix(receipts): manuelle Betrag/Lieferant-Werte speichern und Crop-Griffe vergroessern`
- `fix(scanner): groessere Crop-Griffe und Auto-Capture bei Belegerkennung`
- `feat(receipts): Speichern/Uebertragen, Filter merken, Mehrfachaktion, KI-Sanduhr`
- `fix(ui): Sanduhr nur waehrend KI-Erkennung anzeigen`
- `feat(ui): animierten KI-Ring (Option C) statt stiller Sanduhr`

---

## 6. Kurzer Testplan

1. Beleg fotografieren → Crop → nach Bestaetigung: animierter Ring nur in der KI-Phase
2. Betrag/Lieferant manuell aendern → Speichern → Werte bleiben
3. Speichern & Uebertragen → bei Erfolg geschlossen (`SENT` / `COMPLETED`)
4. Liste filtern → Beleg oeffnen → Zurueck → Filter noch aktiv
5. Filter zuruecksetzen
6. Mehrere Belege markieren → Freigeben / Uebertragen
