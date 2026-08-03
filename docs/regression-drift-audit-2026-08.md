# Drift- und Stabilitaets-Audit — August 2026

Stand: 2026-08-03

## Zusammenfassung (Ampel)

| Bereich | Status | Kommentar |
|---------|--------|-----------|
| TypeScript / Build | 🟢 | `typecheck` und `npm test` bestehen fehlerfrei |
| Feature-Implementierung | 🟢 | Belegliste, Kamera, Dashboard, PWA korrekt |
| Prisma Schema ↔ Migrationen | 🔴 | 12+ Felder/Models im Schema ohne Migration |
| Migrations-Integritaet | 🟡 | Zwei ueberlappende Init-Migrationen |
| Route/Nav-Konsistenz | 🟢 | Guards korrekt, Redirect funktional |
| Backup-Pfad-Konfiguration | 🟡 | Default-Pfad laeuft ins Leere bei Neuinstallation |
| Dokumentation | 🟡 | Phase-2 Docs referenzieren veraltete Routen |
| Testabdeckung | 🟡 | Nur 4 Test-Dateien, kritische neue APIs ohne Tests |

---

## Findings nach Severity

### P0 — Kritisch (Deployment-Blocker fuer Neuinstallationen)

#### P0-1: Schema-Felder ohne Migration

**Problem:** 12+ Felder und 1 komplettes Model (`ReceiptComment`) existieren im Prisma-Schema, haben aber keine entsprechende SQL-Migrationsdatei. Ein frisches `prisma migrate deploy` wuerde eine unvollstaendige DB erzeugen; Code der diese Felder nutzt wuerde sofort fehlschlagen.

**Betroffene Elemente (kein SQL vorhanden):**

| Typ | Element | Genutzt in Code? |
|-----|---------|-----------------|
| Enum | `ReviewStatus` (DRAFT, IN_REVIEW, APPROVED, DEFERRED, COMPLETED) | Ja (reports, receipts API, list) |
| Feld | `Receipt.reviewStatus` + Index | Ja (groupBy, Filter) |
| Feld | `Receipt.reviewedById` + FK | Ja (reviewer-Relation) |
| Feld | `Receipt.reviewedAt` | Ja (Review-Actions) |
| Feld | `Receipt.invoiceNumber` (VARCHAR 80) + Index | Ja (Duplikat-Check, Edit-Form) |
| Feld | `Receipt.serviceDate` (DATE) + Index | Ja (Edit-Form) |
| Feld | `Receipt.dueDate` (DATE) + Index | Ja (Edit-Form) |
| Feld | `Receipt.netAmount` (Decimal 12,2) | Ja (Receipt-Form) |
| Feld | `Receipt.taxAmount` (Decimal 12,2) | Ja (Receipt-Form) |
| Feld | `Receipt.datevProfileId` + FK + Index | Ja (Receipts API) |
| Feld | `Receipt.deletedAt` (DateTime) + Index | Ja (Soft-Delete, WHERE-Klauseln) |
| Model | `ReceiptComment` (komplett) | Ja (Comments API) |

**Auswirkung:** Auf Produktion funktioniert alles, da Felder manuell via psql angelegt wurden. Bei jeder neuen Umgebung (Staging, Dev, CI) fehlen diese Spalten.

**Fix:** Catch-Up-Migration `20260803230000_add_missing_fields` erstellt (in diesem PR).

---

### P1 — Wichtig (Risiko bei Neuinstallation/Wartung)

#### P1-1: Zwei ueberlappende Init-Migrationen

**Problem:** `20260401_init` und `20260402_stammdaten_erweitert` erzeugen jeweils die komplette DB-Struktur mit `CREATE TABLE`-Statements. Auf einer frischen DB wuerde die zweite Migration fehlschlagen (`relation already exists`).

**Ursache:** `stammdaten_erweitert` war als Ersatz fuer `init` gedacht (erweitertes Schema mit DatevProfile, Country.currencyCode, optionalem Country.code), wurde aber als separate Migration daneben platziert.

**Unterschiede:**
- `init`: SmtpConfig hat `datevAddress` (existiert nicht mehr im Schema)
- `stammdaten_erweitert`: SmtpConfig hat `replyToAddress`, + `DatevProfile`, `Country.currencyCode`
- Schema matcht `stammdaten_erweitert`

**Empfehlung:** Die `20260401_init`-Migration aus dem Ordner entfernen oder als `IF NOT EXISTS`-Guards erweitern. Nicht in diesem PR umgesetzt (benoetigt Prod-DB-Abstimmung).

#### P1-2: BackupConfig.localPath Default-Pfad laeuft ins Leere

**Problem:** Inkonsistenter Default fuer `BackupConfig.localPath`:
- Schema: `@default("/app/storage/backups")`
- Migration SQL: `DEFAULT '/backups'`
- Code-Fallback (backup-service.ts, API): `"/backups"`

Docker-Volume mappt `storage:/app/storage`. Der Pfad `/backups` existiert nicht im Volume — Backups auf einem frisch deployter Container wuerden in den ephemeral Container-FS geschrieben und bei Restart verloren gehen.

**Empfehlung:** Code-Fallback und Migration-Default auf `/app/storage/backups` angleichen. Schema-Default ist korrekt.

**Fix:** Code-Fallback in `backup-service.ts` und API-Route korrigiert (in diesem PR).

---

### P2 — Minor (Docs, Kosmetik, Testluecken)

#### P2-1: Docs referenzieren veraltete Reporting-Route

`docs/phase-2.md` (Zeile 19): Route `/admin/reports` — tatsaechlich existiert die Seite nur noch als Redirect auf `/dashboard`. Die Funktion ist korrekt, aber Doku ist irrefuehrend fuer neue Entwickler.

#### P2-2: ARCHITECTURE.md Dateibaum veraltet

Der Dateibaum in `docs/ARCHITECTURE.md` (ab Zeile 1100) zeigt die Route-Struktur ohne `(dashboard)` Route Group und ohne die neueren Admin-Seiten (AI, Backup, Dashboard-Config, Reports).

#### P2-3: Admin-Settings-Seite unvollstaendig

`src/app/(dashboard)/admin/settings/page.tsx` listet nur SMTP + DATEV. Die neueren Admin-Bereiche (KI-Einstellungen, Backup) sind nur ueber die Sidebar erreichbar, fehlen aber auf der Settings-Uebersicht.

#### P2-4: Fehlende Tests fuer kritische neue Pfade

Aktuelle Testabdeckung: 4 Dateien (require-auth, validation, send-readiness, exchange-rates). Keine Tests fuer:
- `/api/dashboard/config` (CRUD)
- `/api/reports/summary` (komplexe Aggregation)
- `/api/receipts/duplicates` (Scoring-Logik)
- `/api/admin/backup/*` (Backup-Service)
- Widget-Catalog Merge-Logik

#### P2-5: CSS-Klasse `receipt-row--pending` fuer OPEN-Status

Semantik-Mismatch: Status `OPEN` bekommt Klasse `receipt-row--pending` (gelb). Kein Bug, aber beim Debugging verwirrend.

---

## Bestandene Pruefungen (kein Finding)

| Bereich | Ergebnis |
|---------|----------|
| TypeScript `tsc --noEmit` | ✅ 0 Fehler |
| Vitest (`npm test`) | ✅ 52/52 Tests bestanden |
| Belegliste Pagination (25/50/75/100/all) | ✅ korrekt implementiert |
| Belegliste Zeilenfarben (SENT/OPEN/FAILED) | ✅ CSS vorhanden und zugeordnet |
| Belegliste klickbare Zeilen + Keyboard | ✅ `role="link"`, Enter/Space |
| Belegliste Spalten-Dropdowns | ✅ Swap-Logik + localStorage |
| Kamera Scan-Beam Animation | ✅ Ping-pong CSS (@keyframes, prefers-reduced-motion) |
| Crop-Editor Flow | ✅ Bounds, Drag, Confirm/Skip/Retake |
| Duplikaterkennung API + UI | ✅ Score-basiert, Warning-Component |
| PWA Manifest | ✅ Valide Icons, start_url, standalone |
| Service Worker | ✅ API-Pfade explizit ausgeschlossen |
| Dashboard Widget Catalog | ✅ 19 Typen in Catalog = 19 Typen gerendert |
| Admin-Guard `/dashboard` | ✅ requireAdmin() in Page + API |
| Admin-Guard `/api/dashboard/config` | ✅ requireAdmin() |
| Admin-Guard `/api/reports/summary` | ✅ requireAdmin() |
| `/admin/reports` Redirect | ✅ redirect("/dashboard") |

---

## Empfohlene naechste Schritte (priorisiert)

1. **[In diesem PR]** Catch-Up-Migration fuer fehlende Schema-Felder
2. **[In diesem PR]** Backup-Pfad-Fallback im Code korrigieren
3. **[Naechster Sprint]** Init-Migration-Konflikt aufloesen (20260401 entfernen oder mergen)
4. **[Naechster Sprint]** Mindestens Unit-Tests fuer `duplicate-check.ts` Scoring und `widget-catalog.ts` Merge-Logik
5. **[Backlog]** ARCHITECTURE.md Dateibaum aktualisieren
6. **[Backlog]** Admin-Settings-Seite um KI + Backup erweitern
7. **[Backlog]** phase-2.md Route-Referenz auf `/dashboard` aktualisieren

---

## Durchgefuehrte Fixes in diesem PR

| Fix | Datei | Beschreibung |
|-----|-------|--------------|
| P0-1 | `prisma/migrations/20260803230000_add_missing_fields/migration.sql` | Catch-Up-Migration fuer ReviewStatus, ReceiptComment, Receipt-Felder |
| P1-2 | `src/lib/backup/backup-service.ts` | localPath Fallback: `/backups` → `/app/storage/backups` |
| P1-2 | `src/app/api/admin/backup/config/route.ts` | localPath Default: `/backups` → `/app/storage/backups` |
