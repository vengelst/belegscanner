# BelegBox - Priorisierte Massnahmen

Stand: 2026-04-02

## Top 10

1. [x] Filter- und Exportvertrag fuer `reviewStatus` vereinheitlichen.
2. [x] Review-Workflow fuer `reopen` fachlich festziehen und serverseitig korrigieren.
3. [x] Standard-Seed in Stammdaten-Seed und optionale Demo-Daten trennen.
4. [x] E-Mail/Passwort-Login mit Brute-Force-Schutz ergaenzen.
5. [x] Build-/Renderingstrategie pruefen, damit `next build` nicht still an einer produktiven DB scheitert.
6. [x] Pflichtlogik fuer Originaldatei im Erfassungsprozess klaeren und konsistent durchsetzen.
7. [x] Receipt-Update-API auf gemeinsames Zod-Schema heben.
8. [x] OCR-Vorbelegung so absichern, dass manuelle Eingaben nicht ueberschrieben werden.
9. [x] Reporting-Kennzahlen fuer gemischte Originalwaehrungen fachlich korrigieren.
10. [x] README und Betriebsdokumente als verlaesslichen Einstiegspfad vervollstaendigen.

## Im aktuellen Umsetzungsdurchgang erledigt
- Receipt-Update auf gemeinsames Zod-Basisschema gehoben
- OCR-Vorbelegung gegen stille Ueberschreibung manueller Eingaben abgesichert
- `reviewStatus` zentralisiert und zwischen UI, API und Export auf einen Vertrag gezogen
- Reporting fuer Originalwaehrungen in EUR-Summen, Fremdwaehrungsanzahl und Summen je Waehrung getrennt
- Standard-Seed und optionaler Demo-Seed sauber getrennt
- README, Setup-, Deployment- und Go-Live-Doku auf den aktuellen Stand gebracht

## Bereits im Audit direkt erledigt

- Upload-Endpunkt mit Eigentumspruefung abgesichert.
- `typecheck` reproduzierbar gemacht.
