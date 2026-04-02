# BelegBox - Manuelle Test-Checkliste

Stand: 2026-04-02
Voraussetzung: PostgreSQL laeuft, `prisma migrate dev` und `prisma db seed` wurden ausgefuehrt, `.env` ist konfiguriert.

---

## 1. Login

- [ ] Login mit E-Mail + Passwort (Admin-User aus Seed)
- [ ] Fehlermeldung bei falschem Passwort
- [ ] Fehlermeldung bei unbekannter E-Mail
- [ ] Nach Login: Weiterleitung zu /receipts
- [ ] Header zeigt Benutzername und Admin-Badge
- [ ] Logout-Button funktioniert, leitet zu /login

## 2. PIN-Login

- [ ] PIN setzen ueber Einstellungen (/settings)
- [ ] Standardwerte fuer Zweck, Kategorie, Land, Kfz speichern und erneut auf /receipts/new pruefen
- [ ] Login mit E-Mail + 4-stelliger PIN
- [ ] Fehlermeldung bei falscher PIN
- [ ] Sperre nach 5 Fehlversuchen (5 Minuten)

## 3. Benutzerverwaltung (Admin)

- [ ] Admin -> Benutzer: Liste wird angezeigt
- [ ] Neuen Benutzer anlegen (Name, E-Mail, Passwort, Rolle)
- [ ] Doppelte E-Mail wird abgelehnt
- [ ] Rolle wechseln (Admin <-> User)
- [ ] PIN setzen/entfernen
- [ ] Benutzer deaktivieren
- [ ] Eigenen Account kann man nicht deaktivieren

## 4. Stammdaten (Admin)

- [ ] Laender: Liste, Anlegen, Bearbeiten, Deaktivieren
- [ ] Kfz: Liste, Anlegen, Bearbeiten, Deaktivieren
- [ ] Zwecke: Liste, Anlegen, Bewirtungs-Flag setzen, Deaktivieren
- [ ] Kategorien: Liste, Anlegen, Bearbeiten, Deaktivieren
- [ ] Versandstatus: Read-only-Ansicht mit allen 5 Status
- [ ] Deaktivierte Eintraege erscheinen nicht mehr in Dropdowns

## 5. SMTP-Einstellungen (Admin)

- [ ] SMTP-Formular speichern (Host, Port, User, Passwort, From)
- [ ] Passwort wird maskiert angezeigt (********)
- [ ] Test-Mail senden (an Absender-Adresse)
- [ ] Fehlermeldung bei ungueltigem Server

## 6. DATEV-Profile (Admin)

- [ ] Neues Profil anlegen (Name, DATEV-Adresse, Absender)
- [ ] Als Standard markieren
- [ ] Profil deaktivieren
- [ ] Bei mehreren Profilen: Auswahl im Versand sichtbar

## 7. Beleg erfassen

- [ ] /receipts/new oeffnen
- [ ] Auf Mobilgeraet: "Kamera in App oeffnen" sichtbar, wenn HTTPS oder localhost genutzt wird
- [ ] Bild hochladen (JPG/PNG) -> Vorschau wird angezeigt
- [ ] Kamera oeffnen -> Dokumentstatus sichtbar (erkannt / unsicher / nicht erkannt)
- [ ] Kamera oeffnen -> Auto-Capture loest nur bei stabilem, scharfem, ausreichend hellem Dokument aus
- [ ] Kamera oeffnen -> Foto aufnehmen -> pruefen -> uebernehmen
- [ ] OCR laeuft automatisch, Ergebnisse erscheinen
- [ ] Bei Foto-Belegen Hinweis sichtbar: Original bleibt unveraendert, OCR nutzt Arbeitskopie
- [ ] Bei Auto-Capture: Quelle als Kamera (Auto-Capture) gekennzeichnet
- [ ] Bei Kamerafoto: OCR-Arbeitskopie zeigt Crop/Ausrichtung in den Hinweisen an
- [ ] OCR-Werte werden als Vorbelegung in Formularfelder uebernommen
- [ ] OCR zeigt strukturierte Vorschlaege fuer Uhrzeit, Ort, Land, Zahlungsart und Kartenendziffern, wenn erkennbar
- [ ] OCR markiert unsichere Werte sichtbar als Vorschlag / unsicher
- [ ] Land wird nur bei hoher Plausibilitaet automatisch gesetzt, sonst als Vorschlag angeboten
- [ ] Kartenziffern zeigen nur 2 bis 4 Endziffern und niemals volle Kartennummern
- [ ] Vorbelegungshinweis zeigt letzte Werte oder Benutzer-Standards an, wenn vorhanden
- [ ] Textbasiertes PDF hochladen -> OCR-Vorschlaege erscheinen
- [ ] Gescanntes PDF hochladen -> OCR versucht Seitenbild-Analyse, manuelle Eingaben bleiben vorrangig
- [ ] PDF ohne brauchbaren Text -> klare Hinweis-Meldung, manuelle Erfassung bleibt moeglich
- [ ] Zu grosse Datei (>20 MB) wird abgelehnt
- [ ] Ungueltiger Dateityp wird abgelehnt
- [ ] Kameraberechtigung verweigern -> klare Fehlermeldung, Upload bleibt weiter nutzbar
- [ ] Pflichtfelder: Datum, Betrag, Zweck, Kategorie
- [ ] "Speichern" -> Weiterleitung zur Detailseite
- [ ] "Speichern & naechsten Beleg erfassen" -> neue leere Dateiauswahl, letzte Zuordnungen bleiben vorbelegt
- [ ] "Speichern & Senden" -> Beleg wird gespeichert und versendet
- [ ] Status nach Speichern: OPEN
- [ ] Status nach Speichern & Senden (Erfolg): SENT

## 8. Bewirtungslogik

- [ ] Zweck "Bewirtung" waehlen -> Bewirtungsfelder erscheinen
- [ ] Pflichtfelder: Anlass, Gaeste, Ort
- [ ] Speichern ohne Bewirtungsangaben -> Fehlermeldung (server)
- [ ] Bewirtungsdaten in Detailansicht sichtbar
- [ ] Bei als Bewirtung erkannten Belegen erscheinen Bewirtungshinweise und Positionen als OCR-Vorschlaege, ohne Anlass/Gaeste automatisch zu erfinden
- [ ] Bewirtungsdaten in Druckansicht sichtbar
- [ ] Bewirtungsdaten bearbeitbar in Edit-Form
- [ ] Zweck wechseln weg von Bewirtung -> Felder verschwinden
- [ ] Warnung in Detailansicht wenn Bewirtung fehlt bei Bewirtungszweck

## 9. Beleg bearbeiten

- [ ] /receipts/{id}/edit -> Formular mit vorhandenen Daten
- [ ] Metadaten aendern (Datum, Betrag, Lieferant, etc.)
- [ ] Bewirtungsdaten aendern
- [ ] Speichern -> Weiterleitung zur Detailseite
- [ ] Versandstatus ist nicht manuell editierbar

## 10. DATEV-Versand

- [ ] Detailseite: "Jetzt senden" Button bei Status OPEN
- [ ] Versand erfolgreich -> Status wird SENT
- [ ] Versand fehlgeschlagen -> Status wird FAILED
- [ ] "Erneut senden" bei FAILED -> Status wird RETRY -> SENT/FAILED
- [ ] "Erneut senden" bei SENT -> erneuter Versand moeglich
- [ ] Versandhistorie zeigt alle Versuche mit Zeitpunkt
- [ ] Fehlermeldung sichtbar bei fehlgeschlagenem Versand
- [ ] Versand ohne SMTP -> klare Fehlermeldung
- [ ] Versand ohne DATEV-Profil -> klare Fehlermeldung
- [ ] Versand ohne Datei -> klare Fehlermeldung

## 11. Belegliste

- [ ] /receipts zeigt alle eigenen Belege
- [ ] Admin sieht alle Belege mit Benutzer-Filter
- [ ] Suche nach Lieferant funktioniert
- [ ] Suche nach Bemerkungstext funktioniert
- [ ] Status-Chips filtern korrekt (offen, gesendet, fehlgeschlagen)
- [ ] Erweiterte Filter: Zweck, Kategorie, Land, Kfz, Zeitraum
- [ ] "Filter zuruecksetzen" loescht alle Filter
- [ ] Pagination bei >20 Belegen
- [ ] Empty State bei keinen Treffern
- [ ] Mobile: Card-Ansicht
- [ ] Desktop: Tabellen-Ansicht

## 12. Detailansicht

- [ ] Alle Belegdaten sichtbar
- [ ] Originalbild wird angezeigt
- [ ] PDF wird als iframe angezeigt
- [ ] Versandstatus-Badge sichtbar
- [ ] Versandhistorie sichtbar
- [ ] OCR-Rohtext sichtbar (falls vorhanden)
- [ ] Smart-Capture-Vorschlaege in Detailansicht sichtbar (Belegtyp, Land, Zahlungsart, Kartenendziffern, Tank-/Bewirtungshinweise)
- [ ] Unterkunftsbeleg -> Hotel/Unterkunft wird als Typ erkannt, Zusatzfelder und Hinweise erscheinen
- [ ] Parkbeleg -> Parktyp, Ort, Dauer und Ein-/Ausfahrtszeiten erscheinen nur als Vorschlaege
- [ ] Mautbeleg -> Mauttyp, Station/Streckenhinweis/Fahrzeugklasse erscheinen nur als Vorschlaege
- [ ] Unterkunfts-/Bewirtungs-Positionshinweise werden in Erfassung und Detailansicht sichtbar angezeigt
- [ ] Feldstatus in Detailansicht nachvollziehbar (OCR sicher / unsicher / manuell bestaetigt / manuell gesetzt)
- [ ] Bewirtungsblock nur bei Bewirtungsbelegen
- [ ] Waehrungsblock nur bei Fremdwaehrung
- [ ] "Bearbeiten", "Druckansicht", "PDF" Buttons vorhanden

## 13. Druckansicht

- [ ] /receipts/{id}/print -> A4-Layout wird angezeigt
- [ ] Belegbild oben, Daten unten
- [ ] Bewirtungsblock nur bei Bewirtung
- [ ] Waehrungsblock nur bei Fremdwaehrung
- [ ] "Drucken" Button funktioniert (Browser-Print-Dialog)
- [ ] Im Druck: keine Navigation, kein UI-Chrome
- [ ] PDF-Download ueber /api/receipts/{id}/pdf

## 14. Theme

- [ ] Hell/Dunkel umschaltbar
- [ ] Druckansicht immer hell (unabhaengig vom Theme)

## 15. Admin-Dashboard

- [ ] /admin/dashboard zeigt Belegzaehler (gesamt, offen, gesendet, fehlgeschlagen)
- [ ] Benutzer-Anzahl korrekt
- [ ] SMTP-Status: "Konfiguriert" oder "Nicht konfiguriert"
- [ ] DATEV-Profile-Anzahl korrekt

## 16. Robustheit

- [ ] Beleg ohne Datei: Detail zeigt "Keine Belegdatei" Warnung
- [ ] Bewirtung fehlt bei Bewirtungszweck: Warnung in Detail
- [ ] Fremdwaehrung ohne Kurs: Warnung in Detail
- [ ] Deaktivierter Stammdatensatz bleibt an alten Belegen referenziert
