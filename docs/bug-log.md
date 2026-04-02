# BelegBox - Bug-Log

Stand: 2026-04-02

---

## BUG-001: sendAfterSave Race Condition

- **Bereich:** Belegerfassung
- **Schwere:** HOCH
- **Beschreibung:** Die "Speichern & Senden"-Funktion nutzte React-State (`sendAfterSave`), der per `onClick` gesetzt wurde, bevor die Form-Action den Wert las. Durch React-Batching konnte der State-Update verzoegert sein, sodass die falsche Aktion ausgefuehrt wurde.
- **Reproduktion:** "Speichern & Senden" klicken bei bestimmten Browser/React-Versionen.
- **Erwartung:** Beleg wird gespeichert UND gesendet.
- **Ist-Verhalten:** Beleg wurde nur gespeichert (State-Update nicht rechtzeitig).
- **Korrektur:** State durch `name="_action" value="save|send"` auf den Submit-Buttons ersetzt. `formData.get("_action")` wird in der Form-Action gelesen.
- **Status:** BEHOBEN
- **Datei:** `src/components/receipts/receipt-form.tsx`

## BUG-002: Decimal-to-Number Casting in Receipt PUT

- **Bereich:** Belegbearbeitung API
- **Schwere:** HOCH
- **Beschreibung:** Die PUT-Route castete Prisma-Decimal-Objekte mit `as number`, was keine echte Konvertierung durchfuehrt. `Math.round((decimal / number) * 100)` wuerde Fehler werfen oder NaN liefern.
- **Reproduktion:** Beleg bearbeiten, Waehrung oder Betrag aendern.
- **Erwartung:** EUR-Betrag wird korrekt neu berechnet.
- **Ist-Verhalten:** Potenziell NaN oder falscher Betrag.
- **Korrektur:** `Number()` fuer explizite Konvertierung, Safety-Check `exchangeRate > 0`.
- **Status:** BEHOBEN
- **Datei:** `src/app/api/receipts/[id]/route.ts`

## BUG-003: SMTP ohne Passwort bei Ersteinrichtung

- **Bereich:** SMTP-Einstellungen
- **Schwere:** MITTEL
- **Beschreibung:** Beim erstmaligen Speichern der SMTP-Konfiguration war kein Passwort erforderlich. Die leere `passwordEncrypted`-Zeichenkette wuerde spaeter beim Versand zu einem Entschluesselungsfehler fuehren.
- **Reproduktion:** SMTP-Formular zum ersten Mal speichern ohne Passwort.
- **Erwartung:** Fehlermeldung "Passwort erforderlich".
- **Ist-Verhalten:** SMTP wurde ohne Passwort gespeichert, Versand schlaegt spaeter fehl.
- **Korrektur:** Pruefung hinzugefuegt: Passwort ist bei Ersteinrichtung Pflicht.
- **Status:** BEHOBEN
- **Datei:** `src/app/api/settings/smtp/route.ts`

## BUG-004: User PUT ambigue Passwort-/Profil-Erkennung

- **Bereich:** Benutzerverwaltung API
- **Schwere:** MITTEL
- **Beschreibung:** Die PUT-Route versuchte anhand des Zod-Schema-Parsings zu erkennen, ob ein Passwort-Reset oder ein Profil-Update vorliegt. Ein Body wie `{ password: "neuesPasswort123", name: "Neuer Name" }` wuerde als Passwort-Reset behandelt (nur Passwort geaendert, Name ignoriert).
- **Reproduktion:** Admin-PUT mit password + anderen Feldern.
- **Erwartung:** Profil-Update mit Passwort-Aenderung.
- **Ist-Verhalten:** Nur Passwort wurde geaendert, andere Felder ignoriert.
- **Korrektur:** Passwort-Reset wird nur erkannt, wenn der Body NUR das `password`-Feld enthaelt.
- **Status:** BEHOBEN
- **Datei:** `src/app/api/users/[id]/route.ts`

## BUG-005: ocrRawText nicht im Zod-Schema

- **Bereich:** Belegerfassung API
- **Schwere:** MITTEL
- **Beschreibung:** `ocrRawText` wurde unsicher aus dem Request-Body extrahiert (`(body as Record<string, unknown>).ocrRawText as string`) statt ueber Zod validiert. Beliebige Typen (Number, Object) haetten die Datenbank erreichen koennen.
- **Reproduktion:** API-Aufruf mit `ocrRawText: 12345`.
- **Erwartung:** Validierungsfehler oder sichere Konvertierung.
- **Ist-Verhalten:** Wert wurde unvalidiert gespeichert.
- **Korrektur:** `ocrRawText: z.string().nullable().optional()` zum receiptSchema hinzugefuegt, API nutzt `d.ocrRawText`.
- **Status:** BEHOBEN
- **Dateien:** `src/lib/validation.ts`, `src/app/api/receipts/route.ts`

## BUG-006: Doppelte Datei-Uploads ohne Cleanup

- **Bereich:** Datei-Upload API
- **Schwere:** MITTEL
- **Beschreibung:** Wenn fuer einen Beleg zweimal eine Datei hochgeladen wurde, entstanden zwei ReceiptFile-Eintraege vom Typ ORIGINAL. Die aeltere Datei auf Disk wurde ueberschrieben, aber der alte DB-Eintrag blieb bestehen (verwaist).
- **Reproduktion:** Zweimal POST an /api/files/upload mit gleicher receiptId.
- **Erwartung:** Alte Datei wird ersetzt.
- **Ist-Verhalten:** Zwei DB-Eintraege, ein davon verwaist.
- **Korrektur:** `deleteMany` auf bestehende ORIGINAL-Eintraege vor dem Erstellen.
- **Status:** BEHOBEN
- **Datei:** `src/app/api/files/upload/route.ts`

## BUG-007: lastLog.errorMessage null-Fallback

- **Bereich:** Beleg-Detailseite
- **Schwere:** NIEDRIG
- **Beschreibung:** Wenn `lastLog.errorMessage` null war, wurde "null" als Text angezeigt statt eines sinnvollen Fallbacks.
- **Reproduktion:** Versand fehlschlagen lassen mit errorMessage = null.
- **Erwartung:** "Unbekannter Fehler" als Fallback.
- **Ist-Verhalten:** "null" wurde angezeigt.
- **Korrektur:** `?? "Unbekannter Fehler"` als Fallback.
- **Status:** BEHOBEN
- **Datei:** `src/app/(dashboard)/receipts/[id]/page.tsx`
