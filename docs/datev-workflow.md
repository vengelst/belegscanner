# BelegBox - DATEV- und Buchhaltungs-Workflow

Stand: 2026-04-02
Version: 1.2.0

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

## Versandberechtigung

- **USER** kann nur senden, wenn `reviewStatus === APPROVED`
- **ADMIN** kann jederzeit senden (Override)
- Versand-Validierung prueft zusaetzlich: Datei, SMTP, DATEV-Profil, Pflichtfelder

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

| Aktion | USER | ADMIN |
|---|---|---|
| Beleg erfassen | Ja | Ja |
| Zur Pruefung einreichen (DRAFT → IN_REVIEW) | Ja (eigene) | Ja |
| Freigeben (IN_REVIEW/DRAFT → APPROVED) | Nein | Ja |
| Zurueckstellen (IN_REVIEW → DEFERRED) | Nein | Ja |
| Abschliessen (APPROVED → COMPLETED) | Nein | Ja |
| Wieder oeffnen (DEFERRED/COMPLETED → DRAFT) | Ja (eigene) | Ja |
| Senden (APPROVED) | Ja (eigene) | Ja (alle) |
| Senden (nicht APPROVED) | Nein | Ja (Override) |
| Kommentare schreiben | Ja (eigene Belege) | Ja (alle) |
| DATEV-Profile verwalten | Nein | Ja |
