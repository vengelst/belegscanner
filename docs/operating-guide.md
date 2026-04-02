# BelegBox - Betriebsleitfaden

## Taeglicher Betrieb

### App starten

**Docker Compose:**
```bash
docker compose up -d
```

**Bare-Metal:**
```bash
npm run start
```

### App stoppen

```bash
docker compose down          # Docker
# oder: Ctrl+C / kill        # Bare-Metal
```

Daten bleiben in DB und Storage erhalten.

---

## Administration

### Admin-Login

Initialer Admin kommt aus `ADMIN_EMAIL` / `ADMIN_PASSWORD` beim Standard-Seed.
Die lokalen Demo-Zugaenge aus `docs/demo-data.md` existieren nur nach optionalem Demo-Seed.

### Benutzer anlegen

1. Admin -> Benutzer
2. "Neuen Benutzer anlegen": Name, E-Mail, Passwort, Rolle
3. Optional: PIN setzen (fuer Kiosk-Login)

### Stammdaten pflegen

Admin -> Laender / Kfz / Zwecke / Kategorien
- Anlegen: Formular oben ausfuellen, "Anlegen" klicken
- Bearbeiten: "Bearbeiten" in der Zeile klicken
- Deaktivieren: "Deaktivieren" -- Eintrag verschwindet aus Dropdowns, bleibt an alten Belegen

### SMTP aendern

1. Admin -> SMTP
2. Felder anpassen (Host, Port, User, Passwort)
3. "Speichern"
4. "Test-Mail senden" zur Pruefung

### DATEV-Profil aendern

1. Admin -> DATEV-Profile
2. Profil bearbeiten oder neues anlegen
3. "Als Standard" markieren fuer automatische Verwendung beim Versand

---

## Haeufige Betriebssituationen

### Versand schlaegt fehl

**Symptom:** Beleg zeigt Status "fehlgeschlagen" mit roter Fehlermeldung.

**Erste Pruefung:**
1. Detailseite des Belegs oeffnen -> Versandhistorie pruefen
2. Fehlermeldung lesen (z.B. "ECONNREFUSED", "Authentication failed")
3. Admin -> SMTP -> Einstellungen pruefen
4. "Test-Mail senden" zur Pruefung
5. Nach Korrektur: "Erneut senden" auf der Beleg-Detailseite

**Typische Ursachen:**
- SMTP-Server nicht erreichbar
- Falsches Passwort
- Firewall blockiert Port 587/465
- DATEV-Adresse ungueltig

### Login funktioniert nicht

**E-Mail/Passwort:**
- E-Mail korrekt? (Gross-/Kleinschreibung beachten)
- Passwort mindestens 8 Zeichen?
- Benutzer aktiv? (Admin -> Benutzer pruefen)

**PIN-Login:**
- PIN korrekt (4 Ziffern)?
- Nach 5 Fehlversuchen: 5 Minuten Sperre
- PIN ueberhaupt gesetzt? (Admin -> Benutzer -> PIN pruefen)

### OCR liefert keine Ergebnisse

**Erwartetes Verhalten:** Text-PDFs liefern direkte Texterkennung, Scan-PDFs laufen ueber Seitenbild-OCR. Bei schlechten oder leeren PDFs kann die Erkennung trotzdem leer bleiben.

**Bei Dateien ohne Ergebnis:**
- Bild zu unscharf oder zu dunkel
- Text nicht lesbar
- Beleg in unbekannter Sprache (Standard: Deutsch + Englisch)
- OCR-Ergebnisse sind Vorschlaege -- manuelles Ausfuellen ist immer moeglich

### Datei-Upload fehlgeschlagen

- Erlaubte Typen: JPG, PNG, PDF
- Maximale Groesse: 20 MB
- Storage-Verzeichnis beschreibbar? (`STORAGE_PATH`)
- Festplattenplatz verfuegbar?

---

## Wartung

### Datenbank-Backup

```bash
# Docker
docker compose exec db pg_dump -U belegbox belegbox > backup_$(date +%Y%m%d).sql

# Bare-Metal
pg_dump -U postgres belegbox > backup_$(date +%Y%m%d).sql
```

### Storage-Backup

```bash
# Docker
docker cp $(docker compose ps -q app):/app/storage ./storage-backup

# Bare-Metal
cp -r ./storage ./storage-backup
```

### Datenbank-Migration nach Update

```bash
# Docker
docker compose exec app npx prisma migrate deploy

# Bare-Metal
npx prisma migrate deploy
```

### Logs pruefen

```bash
# Docker
docker compose logs app --tail 100

# Bare-Metal
# stdout/stderr des Prozesses
```

SMTP-Fehler sind zusaetzlich im SendLog gespeichert (sichtbar in der Versandhistorie jedes Belegs).

---

## Rollback und Fehlerbehebung

### Fehlgeschlagenes Deployment

1. App-Container stoppen: `docker compose down`
2. Vorherige Image-Version starten (falls vorhanden)
3. Falls Migration fehlgeschlagen: DB aus Backup wiederherstellen
4. Logs pruefen: `docker compose logs app`

### DB-Migrationsprobleme

1. Fehlermeldung lesen: `npx prisma migrate status`
2. Gescheiterte Migration identifizieren
3. Falls noetig: `npx prisma migrate resolve --rolled-back <migration-name>`
4. DB aus Backup wiederherstellen als letzter Ausweg

### SMTP-Probleme in Produktion

1. Admin -> SMTP -> "Test-Mail senden"
2. Fehlermeldung pruefen
3. Provider-Status pruefen (Wartung? Rate-Limit?)
4. Passwort erneut eingeben und speichern
5. Belege koennen spaeter erneut gesendet werden ("Erneut senden")

### OCR funktioniert gar nicht

1. `OCR_LANGUAGE` in .env pruefen (Standard: `deu+eng`)
2. Tesseract.js wird beim ersten Aufruf heruntergeladen -- Internetverbindung noetig
3. Bei Scan-PDFs werden aktuell maximal die ersten drei Seiten per OCR analysiert
4. Belege koennen auch ohne OCR manuell erfasst werden

---

## Funktionskontrolle per Testbeleg

Um die App nach einem Update oder Neustart schnell zu pruefen:

1. Login als Admin
2. Dashboard pruefen (Zaehler sichtbar?)
3. Neuer Beleg -> JPG hochladen
4. OCR-Ergebnisse pruefen (oder manuell ausfuellen)
5. Speichern -> Detailseite korrekt?
6. "Jetzt senden" -> Status SENT?
7. Druckansicht -> A4-Layout korrekt?
8. Belegliste -> Beleg sichtbar, Filter funktionieren?

Dauer: ca. 3 Minuten.
