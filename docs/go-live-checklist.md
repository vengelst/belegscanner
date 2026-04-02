# BelegBox - Go-Live-Checkliste

## Infrastruktur

- [ ] PostgreSQL erreichbar
- [ ] `DATABASE_URL` korrekt gesetzt
- [ ] `AUTH_SECRET` echt generiert
- [ ] `SMTP_ENCRYPTION_KEY` echt generiert
- [ ] `AUTH_URL` auf produktive URL gesetzt
- [ ] HTTPS eingerichtet
- [ ] `STORAGE_PATH` persistent und beschreibbar
- [ ] `prisma migrate deploy` erfolgreich ausgefuehrt
- [ ] `prisma db seed` erfolgreich ausgefuehrt
- [ ] Es wurden keine Demo-Daten geladen

## Initiale Konfiguration

- [ ] Initial-Admin ist ueber env-gesteuerten Seed oder manuell vorhanden
- [ ] SMTP im Admin-Bereich eingerichtet
- [ ] SMTP-Testversand erfolgreich
- [ ] Mindestens ein DATEV-Profil vorhanden und als Standard markiert
- [ ] Stammdaten fuer den produktiven Betrieb geprueft
- [ ] Benutzer fuer alle Mitarbeiter angelegt

## Funktionstest

- [ ] Login mit E-Mail/Passwort funktioniert
- [ ] PIN-Login funktioniert fuer einen dafuer vorgesehenen Benutzer
- [ ] Neuer Beleg erfordert eine Originaldatei
- [ ] OCR liefert nur Vorschlaege und ueberschreibt keine manuellen Eingaben
- [ ] Bewirtungsbeleg verlangt Anlass, Gaeste und Ort
- [ ] Review-Workflow laeuft ueber die vorgesehenen Status
- [ ] CSV-Export spiegelt dieselben `reviewStatus`-Filter wie die UI
- [ ] Reporting zeigt EUR-Summen und Originalsummen je Waehrung fachlich korrekt
- [ ] Versand setzt plausible Versandstatus und protokolliert SendLogs
- [ ] Druckansicht und PDF funktionieren

## Sicherheit

- [ ] Admin-Bereiche sind nur fuer `ADMIN` erreichbar
- [ ] `USER` sieht nur eigene Belege
- [ ] SMTP-Passwort erscheint nicht im Klartext im Frontend
- [ ] Demo-Zugaenge sind in der Zielumgebung nicht vorhanden
- [ ] Admin-Passwort ist kein schwacher Defaultwert

## Nach dem Start

- [ ] Backup fuer PostgreSQL eingerichtet
- [ ] Backup fuer `STORAGE_PATH` eingerichtet
- [ ] Monitoring/Log-Sichtung organisiert
- [ ] Erster echter Testversand mit Steuerberater bestaetigt
