# BelegBox - Offene Punkte nach Audit

Stand: 2026-04-03

---

## Audit-relevante offene Punkte

- Scan-PDF-Staging-Gate ist noch offen. Der Codepfad ist vorhanden, aber der belastbare Praxisnachweis mit echten Scan-PDFs fehlt weiterhin. Siehe `docs/pdf-scan-gate.md` und Finding `PDF-001` in `docs/pdf-analysis-audit.md`.

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

## Smart Capture Phase 6

- Zuschnitt / Crop-UI fuer manuelle Nachkorrektur
- Perspektivkorrektur ueber die aktuelle Crop- und Rotationskorrektur hinaus
- Erweiterte Bildverbesserung und feinere Eckenerkennung
- Noch feinere Laendererkennung fuer grenznahe EUR-Belege und gemischte Sprachsignale
- Mehr Nutzerhilfe fuer unsichere OCR-Vorschlaege und spaetere Review-Unterstuetzung
- Gezieltere manuelle Bestaetigung/Korrektur fuer typ-spezifische Zusatzhinweise (z. B. Unterkunft/Parken/Maut)
- Weitere Typ-Verfeinerung fuer internationale Sonderformate ausserhalb der Kernbelegarten

## PDF-Analyse Phase 4

- Belastbaren Scan-PDF-Nachweis im Staging mit echten Bild-PDFs abschliessen und Gate-Ergebnis dokumentieren
- Mehrzeilige oder komplexe Tabellenpositionen ueber mehrere PDF-Zeilen hinweg robuster zusammenfuehren
- Seitenuebergreifende Rechnungspositionen und Summenabgleich ueber mehrere Seiten
- Komplexere Mengen-/Einheiten-/Rabatt-Sonderfaelle bei textbasierten Rechnungen
- Robusteres Positions-Parsing fuer schwache Scan-PDF-OCR
- Gezieltere Nutzerhinweise fuer PDF-Warnfaelle statt rein generischer OCR-Hinweise

## UX / Komfort

- Favoriten / Schnellvorlagen fuer haeufige Belegkombinationen
- Toast-Benachrichtigungen statt inline-Meldungen
- Offline-Modus (PWA/Service Worker)
- Push-Benachrichtigungen bei Statusaenderung
- Drag-and-Drop Upload
- Bildkompression vor Upload

## Bekannte Einschraenkungen

1. **HTTPS erforderlich fuer Kamera**: Die MediaDevices API funktioniert auf Mobilgeraeten nur ueber HTTPS.
2. **Scan-PDF-OCR ist bewusst begrenzt und aktuell der groesste Praxisrestpunkt**: Textbasierte PDFs werden direkt gelesen, der Seitenbild-Fallback fuer gescannte PDFs ist implementiert, aber noch nicht per Staging-Gate mit echten Praxisdateien freigegeben.
3. **Rechnungs-Kernfelder bleiben heuristische Vorschlaege**: Lieferant, Rechnungsnummer, Rechnungs-/Faelligkeits-/Leistungsdatum sowie Netto/Steuer/Brutto werden robust priorisiert, aber nicht als Vollautomatik behandelt.
4. **Einzelversand**: Kein Batch-/Sammelversand.
5. **Kein E-Mail-Tracking**: SendLog protokolliert SMTP-Versand, nicht die Zustellung beim Empfaenger.
6. **Wechselkurse manuell**: Keine automatische Wechselkurs-Abfrage.
7. **Druckansicht ohne PDF-Einbettung**: Bei PDF-Originalen zeigt die HTML-Druckansicht nur einen Hinweis.

## Empfohlene naechste Schritte

1. Scan-PDF-Gate mit echten Praxisdateien durchlaufen und Urteil in `docs/pdf-analysis-audit.md` nachtragen
2. README und Deployment-Doku nach echtem Staging-Durchlauf gegenpruefen
3. Favoriten / Schnellvorlagen klein und ohne Template-Overhead nachziehen
4. Niedrig priorisierte UI-/Wartbarkeitspunkte aus dem Audit gesammelt nachziehen
