# BelegBox - UAT-Testplan

Stand: 2026-04-02

## Testumgebung

- Lokale Entwicklungsumgebung oder Docker Compose
- PostgreSQL mit `npm run prisma:seed` und optional `npm run prisma:seed:demo` vorbereitet
- Demo-Benutzer nur nach Demo-Seed: demo@belegbox.local / demo1234 / PIN 1234
- Admin-Benutzer aus `.env` oder im Demo-Pfad: admin@belegbox.local / admin1234

---

## UAT-A: Standardbeleg Inland

**Ziel:** Normaler EUR-Beleg aus Deutschland, vollstaendiger Durchlauf.

| Schritt | Aktion | Erwartung |
|---|---|---|
| A1 | Login als Demo-User | Weiterleitung zu /receipts |
| A2 | "Neuer Beleg" klicken | Erfassungsformular oeffnet |
| A3 | JPG-Bild hochladen | Vorschau wird angezeigt, OCR startet |
| A4 | OCR-Ergebnisse pruefen | Datum, Betrag, Lieferant werden vorgeschlagen |
| A5 | Datum korrigieren, Betrag "47,50" eingeben | Komma wird akzeptiert |
| A6 | Waehrung "EUR", Zweck "Tanken", Kategorie "EC-Karte" | Dropdowns aus Stammdaten |
| A7 | Land "Deutschland" waehlen | Dropdown-Auswahl |
| A8 | "Speichern" klicken | Weiterleitung zur Detailseite |
| A9 | Alle Daten in Detailseite pruefen | Betrag, Datum, Lieferant, Status OPEN |
| A10 | "Druckansicht" oeffnen | A4-Layout, alle Daten sichtbar |
| A11 | "PDF" herunterladen | PDF-Datei mit Bild und Daten |
| A12 | "Jetzt senden" klicken | Status wird SENT (bei konfiguriertem SMTP) |
| A13 | Versandhistorie pruefen | Eintrag mit Zeitpunkt und Zieladresse |

## UAT-B: Fremdwaehrungsbeleg

**Ziel:** Beleg in RSD mit Wechselkurs, korrekte EUR-Berechnung.

| Schritt | Aktion | Erwartung |
|---|---|---|
| B1 | Neuer Beleg erstellen | Formular oeffnet |
| B2 | Betrag "1170", Waehrung "RSD" | Felder ausgefuellt |
| B3 | Wechselkurs "117" eingeben | Kursfeld ausgefuellt |
| B4 | Kursdatum setzen | Datum eingetragen |
| B5 | Land "Serbien", Zweck "Maut" | Dropdown-Auswahl |
| B6 | Speichern | Detailseite zeigt: 1170 RSD, 10 EUR, Kurs 117 |
| B7 | Druckansicht pruefen | Waehrungsblock sichtbar mit allen Feldern |

## UAT-C: Bewirtungsbeleg

**Ziel:** Beleg mit Bewirtungspflichtfeldern, bedingte Validierung.

| Schritt | Aktion | Erwartung |
|---|---|---|
| C1 | Neuer Beleg, Zweck "Bewirtung" waehlen | Bewirtungsfelder erscheinen |
| C2 | Speichern ohne Anlass/Gaeste/Ort | Fehlermeldung (Client oder Server) |
| C3 | Anlass "Projektbesprechung", Gaeste "Hr. Mueller, Fr. Schmidt", Ort "Restaurant Berlin" | Felder ausgefuellt |
| C4 | Speichern | Detailseite zeigt Bewirtungsblock |
| C5 | Bearbeiten: Zweck auf "Buero" wechseln | Bewirtungsfelder verschwinden |
| C6 | Speichern | Bewirtungsdaten bleiben erhalten (nicht geloescht) |
| C7 | Bearbeiten: Zweck zurueck auf "Bewirtung" | Bewirtungsfelder erscheinen mit alten Daten |
| C8 | Druckansicht pruefen | Bewirtungsblock sichtbar |

## UAT-D: Fehlversand und Retry

**Ziel:** Versand schlaegt fehl, Retry funktioniert.

| Schritt | Aktion | Erwartung |
|---|---|---|
| D1 | SMTP mit ungueltigem Server konfigurieren | SMTP gespeichert |
| D2 | Beleg senden | Status wird FAILED |
| D3 | Detailseite pruefen | Fehlermeldung sichtbar, Versandhistorie zeigt Fehler |
| D4 | "Erneut senden" klicken | Status wird RETRY, dann SENT oder FAILED |
| D5 | SMTP korrigieren, erneut senden | Status wird SENT |
| D6 | Versandhistorie pruefen | Alle Versuche mit Zeitstempel sichtbar |

## UAT-E: PIN-Login und Berechtigungen

**Ziel:** Kiosk-Modus, Benutzerzuordnung, Rollenschutz.

| Schritt | Aktion | Erwartung |
|---|---|---|
| E1 | Als Demo-User mit PIN 1234 einloggen | Login erfolgreich |
| E2 | Beleg erstellen | Beleg gehoert Demo-User |
| E3 | /admin/dashboard aufrufen | Weiterleitung zu /receipts (kein Admin) |
| E4 | Als Admin einloggen | Admin-Bereich erreichbar |
| E5 | Alle Belege sichtbar (auch von Demo-User) | Admin sieht alles |
| E6 | PIN 5x falsch eingeben | Sperre fuer 5 Minuten |

## UAT-F: Suche und Filter

**Ziel:** Belegliste durchsuchbar und filterbar.

| Schritt | Aktion | Erwartung |
|---|---|---|
| F1 | Belegliste oeffnen | Alle eigenen Belege sichtbar |
| F2 | Suche nach Lieferant-Name | Nur passende Belege |
| F3 | Status-Chip "offen" klicken | Nur OPEN-Belege |
| F4 | Erweiterte Filter: Land "Serbien" | Nur Serbien-Belege |
| F5 | Erweiterte Filter: Zweck "Bewirtung" | Nur Bewirtungsbelege |
| F6 | "Filter zuruecksetzen" | Alle Belege wieder sichtbar |
| F7 | Pagination testen (bei >20 Belegen) | Seiten-Navigation funktioniert |

## UAT-G: Druckansicht

**Ziel:** DIN-A4-Ausdruck vollstaendig und stabil.

| Schritt | Aktion | Erwartung |
|---|---|---|
| G1 | Standardbeleg Druckansicht | Bild oben, Daten unten |
| G2 | "Drucken" Button | Browser-Print-Dialog oeffnet |
| G3 | Bewirtungsbeleg Druckansicht | Bewirtungsblock sichtbar |
| G4 | Fremdwaehrungsbeleg Druckansicht | Waehrungsblock sichtbar |
| G5 | Beleg ohne Datei Druckansicht | "Kein Originalbeleg" Hinweis |
| G6 | PDF-Download | PDF-Datei mit korrektem Layout |
