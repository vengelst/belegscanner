# Claude Code – DATEV-Belegtyp korrekt beim Versand

## Kontext

Repo: `/Users/volkhardengelstadter/coding/belegscanner`  
Prod: `beleg.vivahome.de`, Server `/opt/belegscanner`

DATEV-Versand läuft **nur per E-Mail** (`src/lib/mail.ts`, SMTP → `DatevProfile.datevAddress`). Kein DATEV-REST-API.

### DATEV-Klärung (verbindlich für die Umsetzung)

Bei **DATEV Upload Mail** (Unternehmen online → Belege → Einstellungen → Upload Mail) wird der **Belegtyp durch die Empfänger-Adresse** bestimmt:

- Pro Belegtyp legt man in DATEV eine eigene Zieladresse an („Belegtyp hinzufügen“).
- Mail an die Adresse für „Rechnungseingang“ → landet als Rechnungseingang.
- Mail an die Adresse für „Kasse“ → landet in der Kasse.
- **„ohne Belegtyp“ brauchen wir nicht** – Belegtyp ist immer Pflicht.
- **DATEV Lohn-Unterlagen** brauchen wir nicht.
- Die exakten Anzeigenamen in DATEV (Screenshot):  
  `Rechnungseingang`, `Rechnungsausgang`, `Kasse`, `Kreditkartenbelege`, `Sonstige`, optional `DATEV Reisekosten-Belege`.

Deshalb reicht **eine** `datevAddress` im Profil **nicht**. Pro genutztem Belegtyp braucht das Profil eine eigene Upload-Mail-Adresse.

Referenz-Screenshot: Belegtyp-Dialog in DATEV mit u. a. Rechnungseingang / Rechnungsausgang / Kasse / Kreditkartenbelege.

---

## Ziel

1. Jeder Beleg hat einen **Pflicht-DATEV-Belegtyp** (kein „ohne“).
2. Beim Versand geht die Mail an die **zum Belegtyp passende DATEV-Upload-Adresse**.
3. Admin kann die Adressen je Belegtyp im DATEV-Profil pflegen.
4. Sinnvolle Vorbelegung aus vorhandener Belegrichtung (`partyRole`) + Kategorie (Kasse/Kreditkarte).
5. Versand blockiert, wenn Belegtyp fehlt oder die Adresse für diesen Typ fehlt.

---

## Belegtypen (Enum)

```text
RECHNUNGSEINGANG      → Label "Rechnungseingang"   (Kreditor / Eingangsbeleg)
RECHNUNGSAUSGANG      → Label "Rechnungsausgang"   (Debitor / Ausgangsbeleg)
KASSE                 → Label "Kasse"
KREDITKARTENBELEGE    → Label "Kreditkartenbelege"
SONSTIGE              → Label "Sonstige"
REISEKOSTEN           → Label "DATEV Reisekosten-Belege"  (optional, aber mit aufnehmen)
```

**Nicht** aufnehmen: `OHNE`, Lohn.

DATEV-Label-Strings exakt wie oben (für Doku/UI); die Enum-Werte sind intern.

---

## Datenmodell

### 1. Enum + Feld am Receipt

Prisma:

```prisma
enum DatevBelegtyp {
  RECHNUNGSEINGANG
  RECHNUNGSAUSGANG
  KASSE
  KREDITKARTENBELEGE
  SONSTIGE
  REISEKOSTEN
}

model Receipt {
  ...
  datevBelegtyp  DatevBelegtyp?   // Pflicht vor Versand; bei Create möglichst setzen
}
```

Migration anlegen und anwenden (lokal + Hinweis für Server `npx prisma migrate deploy`).

Bestehende Belege: nullable ok; Versand ohne Wert = Fehler. Optional Backfill-Heuristik in Migration/Seed-Script:
- `partyRole=DEBTOR` → `RECHNUNGSAUSGANG`
- Kategorie-Name enthält „Kasse“ (case-insensitive) → `KASSE`
- Kategorie enthält „Kreditkarte“ → `KREDITKARTENBELEGE`
- sonst `RECHNUNGSEINGANG` wenn CREDITOR

### 2. Adressen je Typ am DatevProfile

Entweder JSON-Spalte oder Relation. Empfohlen klar und typsicher:

```prisma
model DatevProfile {
  ...
  datevAddress String   // bleibt als Fallback / Default für Rechnungseingang (Kompatibilität)
  belegtypAddresses DatevBelegtypAddress[]
}

model DatevBelegtypAddress {
  id            String        @id @default(cuid())
  profileId     String
  profile       DatevProfile  @relation(...)
  belegtyp      DatevBelegtyp
  datevAddress  String        // Upload-Mail-Adresse aus DATEV für diesen Typ
  @@unique([profileId, belegtyp])
}
```

Auflösung beim Versand:
1. Adresse für `receipt.datevBelegtyp` aus `belegtypAddresses`
2. Fallback nur für `RECHNUNGSEINGANG` auf `profile.datevAddress` (bestehende Installationen)
3. Sonst Fehler: „Keine DATEV-Upload-Adresse für Belegtyp X konfiguriert.“

---

## Fachliche Vorbelegung (UI)

Hilfsfunktion z. B. `suggestDatevBelegtyp({ partyRole, categoryName })`:

| Bedingung | Vorschlag |
|---|---|
| `partyRole === DEBTOR` | `RECHNUNGSAUSGANG` |
| Kategorie ~ /kasse/i | `KASSE` |
| Kategorie ~ /kreditkarte/i | `KREDITKARTENBELEGE` |
| Kategorie ~ /reise/i | `REISEKOSTEN` |
| sonst | `RECHNUNGSEINGANG` |

Beim Create/Edit: Select **„DATEV-Belegtyp“** (Pflichtfeld in der Zuordnung oder Belegdaten), vorbelegt mit Vorschlag, jederzeit überschreibbar. Keine Option „ohne“.

Wenn User `partyRole` oder Kategorie ändert und Belegtyp noch dem alten Vorschlag entspricht → neu vorschlagen; wenn manuell überschrieben → nicht überschreiben (Override-Flag oder Vergleich).

---

## Versand (`src/lib/mail.ts`)

1. `validateForSend`: Fehler wenn `datevBelegtyp` fehlt.
2. Nach Profilwahl: Zieladresse = Lookup Belegtyp-Adresse (s. oben); Fehler wenn fehlt.
3. `sendMail({ to: resolvedAddress, ... })`
4. `SendLog.toAddress` = tatsächlich genutzte Adresse.
5. Template-Platzhalter `{belegtyp}` = deutsches Label.
6. Optional Betreff-Default ergänzen: `[{belegtyp}] Beleg {date} - {supplier}` (nur Doku/Default-Text, bestehende Templates nicht zwangsweise umschreiben).

---

## Admin-UI DATEV-Profil

`datev-profile-manager.tsx` + APIs `settings/datev`:

- Pro Belegtyp ein E-Mail-Feld (leer = nicht konfiguriert).
- Hinweistext:  
  „In DATEV Unternehmen online → Belege → Upload Mail je Belegtyp eine Zieladresse anlegen und hier eintragen. Der Belegtyp wird über diese Adresse gesteuert.“
- Speichern/Laden der `DatevBelegtypAddress`-Zeilen.
- `datevAddress` bleibt sichtbar als „Standard / Rechnungseingang (Fallback)“.

Validierung API: E-Mails prüfen; mind. eine Adresse sollte existieren.

---

## Create / Edit / Detail / Send-UI

- Create (`receipt-form`) + Edit: Select Belegtyp, in `buildBody` / PATCH mitschicken.
- Validation Zod: `datevBelegtyp` enum required on create (oder required before send – **bevorzugt required on create**).
- Detail: Belegtyp anzeigen.
- Send-Dialog: Belegtyp + Zieladresse (kurz) anzeigen, damit User sieht wohin es geht.
- `checkSendReadiness` / Warnungen: fehlende Adresse für Typ.

---

## Tests

- Unit: `suggestDatevBelegtyp`
- Unit: Adressauflösung (Typ-Adresse vs. Fallback vs. Fehler)
- Bestehende Mail-Tests anpassen falls vorhanden

---

## Doku

`docs/datev-workflow.md` um Abschnitt **Belegtyp / Upload Mail** ergänzen:
- DATEV steuert Typ über Empfängeradresse
- Mapping unserer Enums ↔ DATEV-Labels
- Admin muss Adressen aus DATEV eintragen
- Kein Lohn, kein „ohne Belegtyp“

---

## Nicht-Ziele

- Keine DATEV REST API (`accounting:documents`)
- Kein Lohn-Belegtyp
- Kein „ohne Belegtyp“
- Keine Änderung am SMTP selbst

---

## Done wenn

1. Migration deployed-fähig.
2. Beleg ohne Belegtyp kann nicht an DATEV.
3. Versand an die typ-spezifische Adresse (mit Fallback nur Rechnungseingang → `datevAddress`).
4. Admin kann Adressen je Typ pflegen.
5. UI Labels wie in DATEV.
6. Commit auf `main`. Push/Deploy macht Cursor; auf Server `prisma migrate deploy` im Container/Deploy-Flow sicherstellen.

Deutsch in UI.
