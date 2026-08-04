# BelegBox - DATEV- und Buchhaltungs-Workflow

Stand: 2026-08-04
Version: 1.3.0

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
- Versand-Validierung prueft zusaetzlich: Datei, SMTP, DATEV-Profil, Pflichtfelder
- Server-Gate in `POST /api/receipts/[id]/send` ist massgeblich (Flag wird aus der DB gelesen)

## DATEV-Profil-Zuordnung

- Jeder Beleg kann ein DATEV-Profil zugeordnet bekommen (`datevProfileId`)
- Wenn kein Profil am Beleg: Default-Profil wird beim Versand verwendet
- Profil-Auswahl beim Versand via DATEV-Profil-Dropdown
- Admin verwaltet Profile unter Admin → DATEV-Profile

## Interne Kommentare

- Jeder authentifizierte Benutzer kann Kommentare am Beleg hinterlassen
- Kommentare sind in der Detailansicht sichtbar
- Benutzer + Zeitstempel werden automatisch gespeichert
- Typische Nutzung: Pruefnotizen, Rueckfragen, Hinweise

## Template-Platzhalter

DATEV-Profile unterstuetzen Betreff- und Body-Templates mit Platzhaltern:

| Platzhalter | Wert |
|---|---|
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
