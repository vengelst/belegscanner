# BelegBox - Risikoanalyse

> Hinweis: ALTSTAND: Risikoanalyse auf frueherem Audit-Stand. Teile der dort genannten Risiken wurden inzwischen behoben.


Stand: 2026-04-02

## Zusammenfassung

Die Anwendung ist funktional deutlich weiter als ein MVP-Rohbau und intern sinnvoll testbar. Fuer Staging und produktionsnahe Freigabe bestehen aber noch relevante Risiken in Sicherheit, Workflow-Konsistenz, Betriebsfaehigkeit und Dokumentationszuverlaessigkeit.

## Risikobild nach Bereich

### Sicherheit
- Upload-Rechtefehler war kritisch, wurde im Audit direkt behoben.
- E-Mail/Passwort-Login hat weiterhin keinen Brute-Force-Schutz.
- Demo-Zugaenge und Demo-Daten im Standard-Seed sind fuer produktionsnahe Umgebungen riskant.
- Sensible SMTP-Daten werden verschluesselt gespeichert; dieser Teil ist grundsaetzlich solide.

### Fachlogik
- Beleg-, Versand- und Review-Workflow sind vorhanden.
- Kritisch bleibt die Inkonsistenz rund um `reviewStatus` in Liste, API und Export.
- Die fachliche Bedeutung von `COMPLETED -> DRAFT` fuer Nicht-Admins ist nicht belastbar geklaert.
- Reporting zeigt mindestens eine fachlich missverstaendliche KPI an.

### Betrieb / Deployment
- Build ist derzeit eng an DB-Verfuegbarkeit gekoppelt.
- Typecheck war nicht robust, wurde im Audit verbessert.
- Dokumente fuer Abnahme und MVP-Status waren zu positiv und wurden auf Audit-Stand korrigiert.

### UX / Bedienbarkeit
- Mobile-first UI ist vorhanden und brauchbar.
- OCR-Unterstuetzung ist praktisch, aber die Uebernahme kann manuelle Eingaben ueberschreiben.
- Belege koennen ohne Originaldatei im System landen, was spaeter zu Folgefehlern fuehrt.

## Blocker-Einschaetzung

### Blockiert Staging
- Inkonsistenter Filter-/Exportvertrag bei `reviewStatus`
- Unklare Build-/DB-Kopplung fuer reproduzierbare Deployments
- Standard-Seed mit Demo-Zugaengen und Demo-Belegen

### Blockiert Go-Live
- Fehlender Brute-Force-Schutz fuer E-Mail/Passwort-Login
- Offene Workflow-Unklarheit bei Review-Reopen
- Unvollstaendige und zuvor irrefuehrende Freigabe-/Betriebsdokumentation

## Positiv stabile Bereiche

- Prisma-Schema und Kernmodell sind gut strukturiert.
- Rollenmodell und die meisten Admin-APIs sind sauber getrennt.
- SMTP-Passwortverschluesselung, Passwort-/PIN-Hashing und sendeseitige Vorabvalidierung sind tragfaehig.
- Druckansicht ist vom Original getrennt, und Originaldateien bleiben als eigenes Artefakt behandelt.
