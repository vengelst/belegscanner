# BelegBox - Fachkonzept

Stand: 2026-04-02 (MVP abgeschlossen)
Quelle: `docs/ARCHITECTURE.md` ist die verbindliche Grundlage.

## Zweck

BelegBox ist eine webbasierte Beleg-App fuer mobile Erfassung, Verwaltung im Browser und einen Kiosk-Modus mit PIN-Login. Ein Beleg wird als Originaldatei unveraendert gespeichert, mit strukturierten Metadaten angereichert und per E-Mail an DATEV versendet.

## Kernfunktionen

- Login mit E-Mail/Passwort und 4-stelliger PIN (Kiosk)
- Benutzerverwaltung mit Rollen ADMIN und USER
- Belegaufnahme per Upload (JPG, PNG, PDF, max 20 MB)
- OCR-Verarbeitung zur Vorbelegung fuer Bild- und PDF-Belege (Tesseract.js, Deutsch + Englisch)
- Formular zur Ergaenzung und Korrektur der Belegdaten
- Komfortfunktionen fuer wiederkehrende Erfassungen (Benutzer-Standards, letzte Werte, Folgeerfassung)
- Stammdatenverwaltung: Laender, Kfz, Zwecke, Kategorien
- DATEV-Versand per SMTP mit konfigurierbaren Profilen
- Versandstatus mit Lebenszyklus und Protokollierung
- Belegliste mit Volltextsuche, Filtern und Pagination
- Detailansicht mit allen Belegdaten und Versandhistorie
- DIN-A4-Druckansicht (HTML + serverseitiges PDF)
- Bewirtungslogik mit bedingten Pflichtfeldern
- Hell-/Dunkelmodus
- Admin-Dashboard mit Statusueberblick

## Belegfachlichkeit

Ein Beleg enthaelt:
- Belegdatum, Betrag, Waehrung, Lieferant (optional)
- Zuordnung zu Zweck, Kategorie (Pflicht), Land, Kfz (optional)
- Versandstatus (systemgefuehrt)
- Bemerkung (Freitext)
- Originaldatei (unveraendert gespeichert)
- OCR-Rohtext (bei Bilddateien, Text-PDFs oder Scan-PDF-OCR)

Regeln:
- Originalbeleg wird unveraendert gespeichert
- Vorbelegung folgt der Prioritaet: aktuelle manuelle Eingabe -> letzte Werte aus Folgeerfassung -> Benutzer-Standards -> System-Defaults
- Druckansicht und Originaldatei sind getrennte Artefakte
- Versandstatus wird systemgefuehrt behandelt (nicht frei editierbar)
- SMTP-Passwort wird AES-256-GCM-verschluesselt gespeichert
- PIN und Passwort werden als bcrypt-Hash gespeichert

## Bewirtungslogik

Gesteuert ueber `Purpose.isHospitality`:
- Pflichtfelder: Anlass, Gaeste/Teilnehmer, Ort
- Validierung client- und serverseitig
- Bewirtungsblock nur sichtbar wenn relevant (Formular, Detail, Druck, PDF)
- Server verhindert Speichern ohne Bewirtungsdaten bei Bewirtungszweck
- Server verhindert Loeschen von Bewirtungsdaten bei Bewirtungszweck

## Versandlogik

Lebenszyklus: OPEN -> READY -> SENT (Erfolg) oder FAILED (Fehler)
FAILED -> RETRY -> SENT oder FAILED
SENT -> RETRY (erneut senden bei Bedarf)

Voraussetzungen fuer Versand:
- Originaldatei vorhanden
- SMTP konfiguriert
- Mindestens ein aktives DATEV-Profil
- Bei Bewirtung: Alle Bewirtungsfelder ausgefuellt
- Bei Fremdwaehrung: Wechselkurs vorhanden

Versandoptionen:
- Manuell: "Jetzt senden" in Detailansicht
- Direkt: "Speichern & Senden" bei Erfassung
- Retry: "Erneut senden" bei Fehler oder bereits gesendet

## Rollen

- USER: Eigene Belege erstellen, bearbeiten, ansehen, senden. Eigenes Profil und PIN pflegen.
- ADMIN: Vollzugriff auf Benutzer, Stammdaten, SMTP, DATEV-Profile, alle Belege, Dashboard.

## Architekturvorgaben

- Next.js 15 App Router (Monolith)
- TypeScript strict
- Tailwind CSS 4
- Prisma + PostgreSQL
- NextAuth.js v5 mit JWT
- Zod fuer Validierung
- Tesseract.js fuer Bild-OCR und Scan-PDF-OCR
- pdf-parse fuer Text-Extraktion aus PDFs und Seitenbild-Fallback
- Nodemailer fuer SMTP
- @react-pdf/renderer fuer PDF
- Lokaler Storage (abstrahierbar fuer spaeteres S3)
