# BelegBox - Datenmodell

Stand: 2026-04-02 (MVP abgeschlossen)
Quelle: `docs/ARCHITECTURE.md` und `prisma/schema.prisma`

## Uebersicht

```
Stammdaten:       Vehicle, Purpose, Category, Country
Bewegungsdaten:   Receipt, Hospitality, ReceiptFile, SendLog
Systemdaten:      User, SmtpConfig, DatevProfile, AuditLog
```

## Enums

### Role
- ADMIN
- USER

### SendStatus
- OPEN: Beleg erfasst, noch nicht versendet
- READY: Uebergang zum Versand
- SENT: Erfolgreich gesendet
- FAILED: Versand fehlgeschlagen
- RETRY: Zum erneuten Senden markiert

### FileType
- ORIGINAL: Hochgeladene Originaldatei
- PRINT_PDF: Generierte Druckdatei

## Relationen

- Ein User hat viele Receipt
- Ein Receipt referenziert optional Country und Vehicle
- Ein Receipt referenziert genau einen Purpose und genau eine Category
- Ein Receipt kann genau einen Hospitality-Datensatz haben
- Ein Receipt hat viele ReceiptFile
- Ein Receipt hat viele SendLog
- Ein User hat viele AuditLog

## Stammdaten

### Vehicle
- plate (eindeutig), description (optional)
- active, sortOrder

### Purpose
- name (eindeutig), isHospitality (steuert Bewirtungslogik)
- active, sortOrder

### Category
- name (eindeutig)
- active, sortOrder

### Country
- code (optional, eindeutig, ISO 3166-1 alpha-2)
- name, currencyCode (optional, ISO 4217)
- active, sortOrder

## Bewegungsdaten

### Receipt
Pflichtfelder: userId, date, amount, currency, amountEur, purposeId, categoryId
Optionale Felder: supplier, countryId, vehicleId, exchangeRate, exchangeRateDate, remark, ocrRawText
Systemfelder: sendStatus (Default OPEN), sendStatusUpdatedAt
Relationen: User, Country, Vehicle, Purpose, Category, Hospitality (1:1), ReceiptFile (1:N), SendLog (1:N)

### Hospitality (1:1 mit Receipt)
Pflichtfelder: occasion, guests, location
Nur bei Purpose.isHospitality = true

### ReceiptFile
type (ORIGINAL/PRINT_PDF), mimeType, filename, storagePath, sizeBytes
Cascade-Delete mit Receipt

### SendLog
sentAt, toAddress, success, errorMessage, messageId
Cascade-Delete mit Receipt

## Systemdaten

### User
email (eindeutig), name, passwordHash (bcrypt), pinHash (optional, bcrypt)
role (ADMIN/USER), active, failedPinAttempts, pinLockedUntil, lastLoginAt

### SmtpConfig (Singleton, id="default")
host, port, secure, username, passwordEncrypted (AES-256-GCM)
fromAddress, replyToAddress (optional)

### DatevProfile
name (eindeutig), datevAddress, senderAddress
subjectTemplate, bodyTemplate (optional)
isDefault, active

### AuditLog
userId, action, entity, entityId, details (JSON)
Modell vorhanden, wird im MVP noch nicht aktiv befuellt.

## Seed-Daten

Zwecke: Buero, Ware, Asset, Tanken, Unterkunft, Bewirtung (isHospitality), Material, Parken, Maut, Sonstiges
Kategorien: Kasse, Kreditkarte, EC-Karte, Bank, privat ausgelegt
Laender: DE (EUR), AT (EUR), CH (CHF), RS (RSD), MK (MKD), HR (EUR)
Admin-User: aus Umgebungsvariablen ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME
