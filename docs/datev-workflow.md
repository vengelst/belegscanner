# BelegBox - DATEV- und Buchhaltungs-Workflow

Stand: 2026-08-07
Version: 1.4.0

---

## Zwei-Status-Modell

BelegBox trennt sauber zwischen technischem Versandstatus und fachlichem Pruef-/Freigabestatus:

### Pruefstatus (ReviewStatus) -- fachlicher Workflow

| Status | Label | Beschreibung | Wer darf setzen |
|---|---|---|---|
| DRAFT | Entwurf | Beleg erfasst, noch nicht geprueft | Automatisch bei Erstellung |
| IN_REVIEW | In Pruefung | Zur Pruefung eingereicht | USER (submit) |
| APPROVED | Freigegeben | Geprueft und freigegeben | ADMIN (approve) |
| DEFERRED | Zurueckgestellt | Zurueckgestellt, muss nachbearbeitet werden | ADMIN (defer) |
| COMPLETED | Abgeschlossen | Beleg abgeschlossen | ADMIN (complete) |

### Versandstatus (SendStatus) -- technischer SMTP-Status

| Status | Beschreibung |
|---|---|
| OPEN | Noch nicht versendet |
| READY | Bereit / wird gerade versendet |
| SENT | Erfolgreich an DATEV gesendet |
| FAILED | Versand fehlgeschlagen |
| RETRY | Zum erneuten Senden markiert |

## Typischer Workflow

```
1. USER erfasst Beleg           → reviewStatus: DRAFT, sendStatus: OPEN
2. USER reicht zur Pruefung ein → reviewStatus: IN_REVIEW
3. ADMIN prueft und gibt frei   → reviewStatus: APPROVED
4. USER/ADMIN sendet an DATEV   → sendStatus: SENT
5. ADMIN schliesst ab           → reviewStatus: COMPLETED
```

Alternativ:
```
3a. ADMIN stellt zurueck        → reviewStatus: DEFERRED
4a. USER bearbeitet und reicht
    erneut ein                   → reviewStatus: IN_REVIEW
```

Optional (Admin-gesteuert, pro User):
```
User mit Recht "Versand ohne Beleg-Freigabe"
  → darf aus DRAFT/IN_REVIEW senden (Vier-Augen entfaellt fuer diesen User)
  → Pruef-/Freigabe-Workflow bleibt sichtbar und nutzbar, ist aber keine Versand-Voraussetzung
```

## Versandberechtigung

Versand an DATEV ist erlaubt, wenn **eine** der folgenden Bedingungen gilt:

1. Rolle **ADMIN**, oder
2. `reviewStatus === APPROVED`, oder
3. User hat `canSendWithoutApproval === true` (Recht „Versand ohne Beleg-Freigabe“)

Details:

- **USER ohne Recht**: braucht `reviewStatus === APPROVED` (Vier-Augen-Prinzip)
- **USER mit Recht**: darf wie Admin bzgl. Review-Status senden (kein APPROVED noetig); Ownership bleibt (nur eigene Belege)
- **ADMIN**: jederzeit senden (Override); das User-Recht ist fuer Admins irrelevant
- Das Recht setzt nur der Admin (Benutzerverwaltung); Default ist aus
- Der Pruef-/Freigabe-Workflow bleibt bestehen und sichtbar
- Versand-Validierung prueft zusaetzlich: Datei, SMTP, DATEV-Profil, DATEV-Belegtyp,
  Upload-Mail-Adresse fuer diesen Belegtyp, Pflichtfelder
- Server-Gate in `POST /api/receipts/[id]/send` ist massgeblich (Flag wird aus der DB gelesen)

## Belegtyp / Upload Mail

**DATEV steuert den Belegtyp ueber die Empfaengeradresse.** Bei DATEV Upload Mail
(Unternehmen online → Belege → Einstellungen → Upload Mail) legt man pro Belegtyp eine
eigene Zieladresse an („Belegtyp hinzufuegen“). Eine Mail an die Adresse fuer
„Rechnungseingang“ landet im Rechnungseingang, eine an die Adresse fuer „Kasse“ in der Kasse.
Der Mail-Inhalt spielt fuer die Zuordnung keine Rolle.

Deshalb gilt in BelegBox:

- Jeder Beleg hat einen **Pflicht-Belegtyp** (`Receipt.datevBelegtyp`). Es gibt kein
  „ohne Belegtyp“ und keinen Lohn-Belegtyp.
- Jedes DATEV-Profil hat **pro genutztem Belegtyp eine eigene Upload-Mail-Adresse**
  (`DatevBelegtypAddress`).
- Der Versand geht an die Adresse des jeweiligen Belegtyps.

### Mapping Enum ↔ DATEV-Anzeigename

| Enum-Wert (intern) | Anzeigename in DATEV |
|---|---|
| `RECHNUNGSEINGANG` | Rechnungseingang |
| `RECHNUNGSAUSGANG` | Rechnungsausgang |
| `KASSE` | Kasse |
| `KREDITKARTENBELEGE` | Kreditkartenbelege |
| `SONSTIGE` | Sonstige |
| `REISEKOSTEN` | DATEV Reisekosten-Belege |

### Beschriftung und Einstellungen

Das Feld heisst in Erfassung, Bearbeitung, Filter und Liste
**„DATEV-Belegtyp (Kategorie)“** - fachlich fuehrend ist der DATEV-Belegtyp,
„Kategorie“ steht nur zur Orientierung in Klammern.

Unter **Admin → Eigene Firma → DATEV-Belegtyp (Kategorie)** werden gepflegt:

- **Standard-Belegtyp** (`OrganizationProfile.defaultDatevBelegtyp`, Default
  `RECHNUNGSEINGANG`): Startwert jedes neuen Belegs und Rueckfallwert der Vorbelegung.
- **Eigene Bezeichnungen** je Belegtyp (`OrganizationProfile.datevBelegtypLabelOverrides`):
  reine Anzeigenamen im Belegscanner. Leer = DATEV-Standardname. Der an DATEV
  uebergebene Belegtyp und die DATEV-Dokumente (PDF, Mail, Export) bleiben
  unveraendert bei den DATEV-Namen.

### Vorbelegung bei Erfassung und Bearbeitung

Der Belegtyp wird im Formular („Zuordnung“) vorgeschlagen und ist jederzeit
ueberschreibbar. Sobald der Nutzer den Typ selbst gewaehlt hat, bleibt seine Wahl stehen.

| Bedingung | Vorschlag |
|---|---|
| `partyRole = DEBTOR` (Ausgangsrechnung) | Rechnungsausgang |
| Kartenzahlung mit hinterlegter Firmenkarten-Endziffer | Kreditkartenbelege |
| Kartenzahlung mit fremder/unbekannter Karte | Kasse |
| Barzahlung | Kasse |
| Bewirtung | Rechnungseingang |
| sonstiger Eingangsbeleg | Rechnungseingang |
| keinerlei belastbare Angaben | **Standard-Belegtyp aus den Einstellungen** |

Ohne belastbare Erkennung wird nicht auf „Sonstige“ geraten, sondern der
konfigurierte Standard-Belegtyp gesetzt (i. d. R. Rechnungseingang).

### Adressauflösung beim Versand

1. Adresse des Belegtyps aus den Belegtyp-Adressen des Profils
2. Nur fuer `RECHNUNGSEINGANG`: Fallback auf `DatevProfile.datevAddress`
   (Kompatibilitaet mit bestehenden Installationen)
3. Sonst Fehler: „Keine DATEV-Upload-Adresse fuer Belegtyp X konfiguriert.“ — der
   Versand wird blockiert.

Die tatsaechlich genutzte Adresse steht im `SendLog.toAddress` und in der Versandhistorie.

### Aufgabe des Admins

Unter **Admin → DATEV-Profile** je Belegtyp die aus DATEV Unternehmen online kopierte
Upload-Mail-Adresse eintragen. Leeres Feld = Belegtyp nicht konfiguriert; Belege dieses
Typs koennen dann nicht versendet werden (Ausnahme: Rechnungseingang faellt auf die
Standard-Adresse zurueck).

### Bestandsbelege

Die Migration `20260807100000_add_datev_belegtyp` setzt den Belegtyp fuer vorhandene
Belege nach obiger Heuristik und uebernimmt die bisherige `datevAddress` als
Upload-Mail fuer Rechnungseingang.

Wird das Schema per `prisma db push` statt `prisma migrate deploy` synchronisiert
(Standard von `scripts/release.ps1`), laeuft dieser Backfill **nicht** mit. Dann einmalig
ausfuehren:

```bash
npm run prisma:backfill:belegtyp
```

## DATEV-Profil-Zuordnung

- Jeder Beleg kann ein DATEV-Profil zugeordnet bekommen (`datevProfileId`)
- Wenn kein Profil am Beleg: Default-Profil wird beim Versand verwendet
- Profil-Auswahl beim Versand via DATEV-Profil-Dropdown
- Admin verwaltet Profile unter Admin → DATEV-Profile
- Der Belegtyp bestimmt innerhalb des gewaehlten Profils die Zieladresse

## Interne Kommentare

- Jeder authentifizierte Benutzer kann Kommentare am Beleg hinterlassen
- Kommentare sind in der Detailansicht sichtbar
- Benutzer + Zeitstempel werden automatisch gespeichert
- Typische Nutzung: Pruefnotizen, Rueckfragen, Hinweise

## Template-Platzhalter

DATEV-Profile unterstuetzen Betreff- und Body-Templates mit Platzhaltern:

| Platzhalter | Wert |
|---|---|
| `{belegtyp}` | DATEV-Belegtyp (Anzeigename, z. B. „Kasse“) |
| `{date}` | Belegdatum (DD.MM.YYYY) |
| `{supplier}` | Lieferant/Haendler |
| `{amount}` | Originalbetrag |
| `{currency}` | Originalwaehrung |
| `{amountEur}` | EUR-Betrag |
| `{user}` | Benutzername |
| `{purpose}` | Zweck |
| `{category}` | Kategorie |
| `{country}` | Land |
| `{vehicle}` | Kfz-Kennzeichen |
| `{remark}` | Bemerkung |

Fehlende Werte werden durch Fallbacks ersetzt (z.B. "Unbekannt", "—").

Default-Betreff ohne eigenes Template: `[{belegtyp}] Beleg {date} - {supplier}`.
Bestehende Templates bleiben unveraendert; `{belegtyp}` kann bei Bedarf ergaenzt werden.

## Rollenmatrix

| Aktion | USER | USER (Versand o. Freigabe) | ADMIN |
|---|---|---|---|
| Beleg erfassen | Ja | Ja | Ja |
| Zur Pruefung einreichen (DRAFT → IN_REVIEW) | Ja (eigene) | Ja (eigene) | Ja |
| Freigeben (IN_REVIEW/DRAFT → APPROVED) | Nein | Nein | Ja |
| Zurueckstellen (IN_REVIEW → DEFERRED) | Nein | Nein | Ja |
| Abschliessen (APPROVED → COMPLETED) | Nein | Nein | Ja |
| Wieder oeffnen (DEFERRED/COMPLETED → DRAFT) | Ja (eigene) | Ja (eigene) | Ja |
| Senden (APPROVED) | Ja (eigene) | Ja (eigene) | Ja (alle) |
| Senden (nicht APPROVED) | Nein | Ja (eigene) | Ja (Override) |
| Kommentare schreiben | Ja (eigene Belege) | Ja (eigene Belege) | Ja (alle) |
| DATEV-Profile verwalten | Nein | Nein | Ja |
| Recht „Versand ohne Beleg-Freigabe“ setzen | Nein | Nein | Ja |
