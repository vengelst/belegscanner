# BelegBox - Offene Punkte nach Audit

Stand: 2026-04-02

---

## Audit-relevante offene Punkte

Aus den priorisierten Audit-Punkten 1 bis 10 ist aktuell kein offener Blocker mehr uebrig.

## Weiterhin bewusst ausserhalb des aktuellen Umfangs

- S3-kompatibler Storage (MinIO / AWS)
- Automatische Backups
- CI/CD-Pipeline
- Wechselkurs-API-Anbindung
- PDF als zweiter DATEV-Anhang
- Batch-Versand
- Audit-Log vollstaendig aktivieren
- Passwort-Vergessen per E-Mail
- Refresh-Tokens

## UX / Komfort

- Favoriten / Schnellvorlagen fuer haeufige Belegkombinationen
- Toast-Benachrichtigungen statt inline-Meldungen
- Offline-Modus (PWA/Service Worker)
- Push-Benachrichtigungen bei Statusaenderung
- Drag-and-Drop Upload
- Bildkompression vor Upload

## Bekannte Einschraenkungen

1. **HTTPS erforderlich fuer Kamera**: Die MediaDevices API funktioniert auf Mobilgeraeten nur ueber HTTPS.
2. **Scan-PDF-OCR ist bewusst begrenzt**: Textbasierte PDFs werden direkt gelesen, gescannte PDFs aktuell ueber die ersten drei Seiten per OCR analysiert.
3. **Einzelversand**: Kein Batch-/Sammelversand.
4. **Kein E-Mail-Tracking**: SendLog protokolliert SMTP-Versand, nicht die Zustellung beim Empfaenger.
5. **Wechselkurse manuell**: Keine automatische Wechselkurs-Abfrage.
6. **Druckansicht ohne PDF-Einbettung**: Bei PDF-Originalen zeigt die HTML-Druckansicht nur einen Hinweis.

## Empfohlene naechste Schritte

1. Betriebsseitige Backup- und Restore-Prozesse verproben
2. README und Deployment-Doku nach echtem Staging-Durchlauf gegenpruefen
3. Favoriten / Schnellvorlagen klein und ohne Template-Overhead nachziehen
4. Niedrig priorisierte UI-/Wartbarkeitspunkte aus dem Audit gesammelt nachziehen
