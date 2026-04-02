# BelegBox - Backup- und Restore-Test

Stand: 2026-04-02
Status: operative Testanleitung

## Ziel

Diese Anleitung prueft, ob Datenbank und Dateispeicher von BelegBox in einer Staging- oder produktionsnahen Umgebung sauber gesichert und wiederhergestellt werden koennen.

## Testumfang

- PostgreSQL-Dump erstellen
- Storage-Verzeichnis sichern
- definierte Testdaten erzeugen
- Datenbank und Storage in eine getrennte Restore-Umgebung einspielen
- Wiederherstellung in der App verifizieren

## Voraussetzungen

- Zugriff auf die Zielumgebung oder eine getrennte Restore-Testumgebung
- PostgreSQL-Zugang mit Backup-/Restore-Rechten
- Zugriff auf `STORAGE_PATH`
- dokumentierter aktueller `.env`-Stand fuer die Restore-Umgebung
- App-Stand ist deployt und startfaehig

## Testobjekte vorbereiten

Vor dem Backup bewusst einen kleinen Datensatz erzeugen:
1. Einen neuen Standardbeleg mit Bild anlegen
2. Einen Fremdwaehrungsbeleg anlegen
3. Einen Bewirtungsbeleg anlegen
4. Einen Versand ausloesen, damit ein `SendLog` entsteht
5. Notieren:
- Benutzername
- Lieferant
- Betrag
- Belegdatum
- Dateiname des Originals
- erwarteter Versandstatus

## Teil A - Backup erstellen

### A1 Datenbank-Backup

#### Docker Compose
```bash
docker compose exec db pg_dump -U belegbox belegbox > backup_test.sql
```

#### Bare Metal
```bash
pg_dump -U <db-user> -d <db-name> > backup_test.sql
```

Pruefen:
- Datei `backup_test.sql` wurde erzeugt
- Dateigroesse ist plausibel und nicht 0 Byte

### A2 Storage-Backup

#### Docker Compose
```bash
docker cp $(docker compose ps -q app):/app/storage ./storage-backup-test
```

#### Bare Metal
```bash
xcopy /E /I /Y storage storage-backup-test
```

Pruefen:
- Originaldateien liegen im Backup-Verzeichnis
- Dateigroesse und Anzahl wirken plausibel

## Teil B - Restore in Testumgebung

Wichtig: Restore nicht auf der produktiven Datenbank testen.

### B1 Ziel vorbereiten
- leere Restore-Datenbank anlegen
- leeres Restore-Storage-Verzeichnis anlegen
- `.env` fuer die Restore-Umgebung auf diese Zielpfade zeigen lassen

### B2 Datenbank zurueckspielen

#### Docker Compose / PostgreSQL-Container
```bash
Get-Content .ackup_test.sql | docker compose exec -T db psql -U belegbox -d belegbox_restore
```

#### Bare Metal
```bash
psql -U <db-user> -d <restore-db> -f backup_test.sql
```

Pruefen:
- Restore laeuft ohne SQL-Fehler durch
- Tabellen und Datensaetze sind vorhanden

### B3 Storage zurueckspielen

#### Docker Compose
```bash
docker cp .\storage-backup-test $(docker compose ps -q app):/app/storage-restore
```

#### Bare Metal
```bash
xcopy /E /I /Y storage-backup-test storage-restore
```

Danach `STORAGE_PATH` der Restore-Umgebung auf das wiederhergestellte Verzeichnis zeigen lassen.

## Teil C - Verifikation nach Restore

1. App mit Restore-Konfiguration starten
2. Als Admin anmelden
3. Belegliste pruefen
4. Die zuvor notierten Testbelege suchen
5. Detailansicht jedes Testbelegs pruefen
6. Originaldatei oeffnen
7. Druckansicht pruefen
8. Versandhistorie pruefen
9. Bewirtungsdaten pruefen
10. Fremdwaehrungsbeleg pruefen

Erwartung:
- alle Belege sind vorhanden
- Belegdateien sind abrufbar
- strukturierte Metadaten sind vollstaendig
- SendLogs sind vorhanden
- Bewirtungs- und Waehrungsdaten stimmen

## Negativpruefung

Optional und sinnvoll:
- Restore nur der DB ohne Storage pruefen
- Erwartung: Belege existieren, aber Originaldateien schlagen nachvollziehbar fehl
- Ergebnis dokumentieren, damit der Betrieb weiss, dass DB-Backup allein nicht ausreicht

## Abnahmekriterien

Der Backup-/Restore-Test gilt als bestanden, wenn:
- SQL-Dump erfolgreich erstellt wurde
- Storage-Backup erfolgreich erstellt wurde
- Restore in eine getrennte Umgebung erfolgreich war
- die definierten Testbelege inklusive Originaldateien wieder vorhanden sind
- Druck-, Detail- und Versandhistorie nachvollziehbar funktionieren

## Ergebnisprotokoll

- Testdatum:
- Umgebung:
- Verantwortlich:
- Backup-Datei erstellt: ja / nein
- Storage-Backup erstellt: ja / nein
- DB-Restore erfolgreich: ja / nein
- Storage-Restore erfolgreich: ja / nein
- Testbeleg 1 wiederhergestellt: ja / nein
- Testbeleg 2 wiederhergestellt: ja / nein
- Testbeleg 3 wiederhergestellt: ja / nein
- Dateien abrufbar: ja / nein
- SendLogs vorhanden: ja / nein
- Offene Probleme:
- Empfehlung fuer Go-Live:
