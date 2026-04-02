# BelegBox - Findings

Stand: 2026-04-02

## Kritisch

### F-001
- ID: F-001
- Titel: Datei-Upload erlaubte fremde Belegmanipulation
- Bereich: Sicherheit / Upload / Rechte
- Schweregrad: kritisch
- Kategorie: Sicherheitsrisiko
- Beschreibung: Der Upload-Endpunkt akzeptierte jede gueltige `receiptId`, ohne nach dem Lookup den Besitz oder Adminrechte zu pruefen.
- Reproduktions- oder Nachweisbasis: Codepruefung in `src/app/api/files/upload/route.ts`
- Erwartetes Verhalten: Nur Eigentemer des Belegs oder Admin duerfen Originaldateien hochladen oder ersetzen.
- Ist-Verhalten: Jeder authentifizierte Benutzer konnte eine Originaldatei fuer fremde Belege ersetzen.
- Risiko / Auswirkung: Fremdmanipulation von Originalbelegen, Integritaetsverlust, potenzieller Datenschutzvorfall.
- Empfehlung: Eigentumspruefung serverseitig erzwingen.
- Direkt behebbar: ja
- Status im Audit: direkt behoben

## Hoch

### F-002
- ID: F-002
- Titel: Build ist von Datenbankerreichbarkeit abhaengig
- Bereich: Build / Deployment
- Schweregrad: hoch
- Kategorie: technischer Fehler
- Beschreibung: Mehrere Server Pages fuehren Prisma-Abfragen bereits waehrend `next build` aus. Bei falscher oder fehlender DB-Verbindung entstehen Build-Logs mit Prisma-Authentifizierungsfehlern.
- Reproduktions- oder Nachweisbasis: lokaler `npm run build`
- Erwartetes Verhalten: Build sollte ohne produktive Datenbankzugriffe stabil und nachvollziehbar ablaufen oder klare Build-Voraussetzungen dokumentieren.
- Ist-Verhalten: Build kompiliert, produziert aber Prisma-Fehler waehrend der statischen Seitengenerierung.
- Risiko / Auswirkung: CI-/Staging-Instabilitaet, irrefuehrende Release-Freigabe, schwerer reproduzierbare Deployments.
- Empfehlung: Renderingstrategie je Seite pruefen und Build-/Runtime-Voraussetzungen klarziehen.
- Direkt behebbar: nein
- Status im Umsetzungsdurchgang: behoben

### F-003
- ID: F-003
- Titel: Workflow-Filter zwischen UI, API und Export inkonsistent
- Bereich: Suche / Filter / Reporting
- Schweregrad: hoch
- Kategorie: fachlicher Fehler
- Beschreibung: Die Receipt-Seite arbeitet mit `reviewStatus`, die API-Liste und der CSV-Export beruecksichtigen diesen Filter jedoch nicht durchgaengig.
- Reproduktions- oder Nachweisbasis: `src/app/(dashboard)/receipts/page.tsx`, `src/app/api/receipts/route.ts`, `src/app/api/receipts/export/route.ts`
- Erwartetes Verhalten: Dieselben Filter muessen ueber UI, API und Export denselben Datenbestand ergeben.
- Ist-Verhalten: Benutzer sehen und exportieren potenziell unterschiedliche Ergebnismengen.
- Risiko / Auswirkung: fachlich falsche Auswertungen, Vertrauensverlust bei Admin-Exports.
- Empfehlung: Filtervertrag zentralisieren und API/Export an die UI angleichen.
- Direkt behebbar: nein
- Status im Umsetzungsdurchgang: behoben

### F-004
- ID: F-004
- Titel: Review-Reopen-Regel erlaubt fragliche Ruecksetzung abgeschlossener Belege
- Bereich: Workflow / Review
- Schweregrad: hoch
- Kategorie: fachlicher Fehler
- Beschreibung: Die Review-API erlaubt `reopen` fuer `COMPLETED` auch ohne Adminrolle, obwohl der Kommentar im Code etwas Restriktiveres beschreibt.
- Reproduktions- oder Nachweisbasis: `src/app/api/receipts/[id]/review/route.ts`
- Erwartetes Verhalten: Abgeschlossene Belege sollten nur nach klar definierter fachlicher Regel wieder geoeffnet werden.
- Ist-Verhalten: Nicht-Admin kann abgeschlossene Belege in `DRAFT` zuruecksetzen.
- Risiko / Auswirkung: Umgehung des Pruefprozesses, Inkonsistenz zwischen Review-Abschluss und spaeterem Versand-/Archivstatus.
- Empfehlung: Fachregel festziehen und serverseitig eindeutig abbilden.
- Direkt behebbar: nein
- Status im Umsetzungsdurchgang: behoben

### F-005
- ID: F-005
- Titel: Seed erzeugt Demo-Zugaenge und Demo-Belege standardmaessig
- Bereich: Betrieb / Sicherheit / Datenbasis
- Schweregrad: hoch
- Kategorie: Sicherheitsrisiko
- Beschreibung: Das Seed-Skript legt Admin-Defaults, Demo-User, Demo-PIN `1234`, Demo-Belege und Beispielversandlogs an.
- Reproduktions- oder Nachweisbasis: `prisma/seed.ts`, `docs/setup.md`, `docs/uat-testplan.md`
- Erwartetes Verhalten: Produktionsnahe Seeds sollten Stammdaten von Demo-Inhalten trennen.
- Ist-Verhalten: Demo-Inhalte sind Teil des Standard-Seed-Pfads.
- Risiko / Auswirkung: Versehentliche Nutzung in Staging/Produktion, schwache Standard-Credentials, verfremdete Test-/Reportingdaten.
- Empfehlung: Stammdaten-Seed und Demo-Seed trennen.
- Direkt behebbar: nein
- Status im Umsetzungsdurchgang: behoben

### F-006
- ID: F-006
- Titel: Abnahmedokumentation stimmt nicht mit dem realen Risiko- und Reifegrad ueberein
- Bereich: Dokumentation / Go-Live
- Schweregrad: hoch
- Kategorie: Dokumentationsluecke
- Beschreibung: Die Abnahme dokumentiert Release-Candidate-Status und bestandene UAT, obwohl noch relevante Sicherheits- und Betriebsrisiken offen sind.
- Reproduktions- oder Nachweisbasis: `docs/mvp-abnahme.md` im Vergleich zu Codepruefung und Buildbefund
- Erwartetes Verhalten: Freigabedokumente muessen den realen Produktstatus widerspiegeln.
- Ist-Verhalten: Dokumente sind zu positiv und dadurch fuer Freigabeentscheidungen unzuverlaessig.
- Risiko / Auswirkung: falsche Staging-/Go-Live-Entscheidungen.
- Empfehlung: Abnahmestatus auf Audit-Basis neu bewerten.
- Direkt behebbar: ja
- Status im Audit: Dokumentation aktualisiert

## Mittel

### F-015
- ID: F-015
- Titel: E-Mail/Passwort-Login war ohne belastbaren Brute-Force-Schutz
- Bereich: Auth / Sicherheit
- Schweregrad: mittel
- Kategorie: Sicherheitsrisiko
- Beschreibung: Der Passwort-Login war nur teilweise gegen wiederholte Fehlversuche gehaertet und konnte die Existenz von Benutzern leichter preisgeben.
- Reproduktions- oder Nachweisbasis: `src/auth.ts`, `src/lib/auth/login-rate-limit.ts`
- Erwartetes Verhalten: Passwort-Login muss serverseitig limitiert werden und keine Benutzerexistenz verraten.
- Ist-Verhalten: Login-Schutz war vorhanden, aber nicht sauber gegen Timing-/Existenzsignale und nicht sauber gegen den aktuellen DB-Zaehlerstand abgesichert.
- Risiko / Auswirkung: erhoehte Angriffsoberflaeche fuer Credential-Stuffing und Enumeration.
- Empfehlung: generische Fehlreaktion und serverseitig belastbare Fehlversuchszahlung verwenden.
- Direkt behebbar: ja
- Status im Umsetzungsdurchgang: behoben

### F-007
- ID: F-007
- Titel: Receipt-Update verwendet kein vollstaendiges Zod-Schema
- Bereich: API / Validierung
- Schweregrad: mittel
- Kategorie: technischer Fehler
- Beschreibung: Die Update-Route setzt Felder selektiv zusammen, statt den gesamten Request konsistent gegen ein Receipt-Update-Schema zu validieren.
- Reproduktions- oder Nachweisbasis: `src/app/api/receipts/[id]/route.ts`
- Erwartetes Verhalten: POST und PUT sollten denselben fachlichen Validierungsvertrag teilen.
- Ist-Verhalten: Update-Validierung ist fragmentierter als Create.
- Risiko / Auswirkung: Feldinkonsistenzen und kuenftige Wartungsfehler.
- Empfehlung: Gemeinsames Update-Schema ableiten und serverseitig zentral verwenden.
- Direkt behebbar: nein
- Status im Umsetzungsdurchgang: behoben

### F-008
- ID: F-008
- Titel: OCR-Vorbelegung kann bereits eingegebene Werte ueberschreiben
- Bereich: Erfassung / UX / OCR
- Schweregrad: mittel
- Kategorie: UX-/Bedienproblem
- Beschreibung: Die Formularlogik uebernimmt OCR-Werte nach Analyse, obwohl der Kommentar eigentlich nur eine Vorbelegung fuer unberuehrte Felder anklingen laesst.
- Reproduktions- oder Nachweisbasis: `src/components/receipts/receipt-form.tsx`
- Erwartetes Verhalten: OCR darf Benutzerkorrekturen nicht still ueberschreiben.
- Ist-Verhalten: OCR-Ergebnisse koennen manuelle Eingaben ersetzen.
- Risiko / Auswirkung: fachlich falsche Datenuebernahme, Frust im mobilen Ablauf.
- Empfehlung: Nur leere oder explizit freigegebene Felder fuellen.
- Direkt behebbar: nein
- Status im Umsetzungsdurchgang: behoben

### F-009
- ID: F-009
- Titel: Originaldatei ist im Erfassungsformular nicht konsequent Pflicht
- Bereich: Belegerfassung
- Schweregrad: mittel
- Kategorie: fachlicher Fehler
- Beschreibung: Das Formular erlaubt das Speichern ohne Datei, obwohl der Originalbeleg fachlich zentrales Pflichtartefakt ist.
- Reproduktions- oder Nachweisbasis: `src/components/receipts/receipt-form.tsx`, Versandvalidierung in `src/lib/mail.ts`
- Erwartetes Verhalten: Belege sollten nicht ohne Originalbeleg in den regulären Prozess gelangen.
- Ist-Verhalten: Receipt kann ohne Datei angelegt werden und scheitert spaeter beim Versand.
- Risiko / Auswirkung: unvollstaendige Belege, Nacharbeit, uneinheitliche Prozessqualitaet.
- Empfehlung: Fachregel fuer Pflichtdatei klarziehen und Create-Flow darauf ausrichten.
- Direkt behebbar: nein
- Status im Umsetzungsdurchgang: behoben

### F-010
- ID: F-010
- Titel: DATEV-Versand ohne generiertes PDF weicht von Teilen der Doku ab
- Bereich: Versand / Dokumentation
- Schweregrad: mittel
- Kategorie: Dokumentationsluecke
- Beschreibung: Der Versand haengt nur die Originaldatei an; das generierte Druck-PDF wird nicht mitgesendet.
- Reproduktions- oder Nachweisbasis: `src/lib/mail.ts`, `docs/mvp-scope.md`, `docs/open-items.md`
- Erwartetes Verhalten: Dokumentation und Implementierung muessen denselben Versandumfang beschreiben.
- Ist-Verhalten: Code und Teile der Doku weichen voneinander ab.
- Risiko / Auswirkung: falsche Anwendererwartung beim DATEV-Prozess.
- Empfehlung: Dokumentation klar auf Ist-Stand bringen oder PDF-Versand spaeter nachziehen.
- Direkt behebbar: ja
- Status im Audit: Dokumentation aktualisiert

### F-011
- ID: F-011
- Titel: Typecheck war nicht reproduzierbar auf frischem Stand
- Bereich: Build / Type Safety
- Schweregrad: mittel
- Kategorie: technischer Fehler
- Beschreibung: `tsc --noEmit` hing implizit an bereits vorhandenen `.next/types`.
- Reproduktions- oder Nachweisbasis: lokaler Typecheck vor und nach `next build`
- Erwartetes Verhalten: `npm run typecheck` muss ohne Vorwissen ausfuehrbar sein.
- Ist-Verhalten: Typecheck konnte wegen fehlender generierter Typdateien scheitern.
- Risiko / Auswirkung: unzuverlaessige CI-Signale.
- Empfehlung: Vor dem Typecheck Route-Typen erzeugen.
- Direkt behebbar: ja
- Status im Audit: direkt behoben

### F-012
- ID: F-012
- Titel: Reporting summiert Originalwaehrungen als EUR-Darstellung
- Bereich: Reporting / Fachlogik
- Schweregrad: mittel
- Kategorie: fachlicher Fehler
- Beschreibung: Die Kennzahl `totalAmountOriginal` wird in der UI als `EUR` formatiert, obwohl sie semantisch Originalwaehrungen mischt.
- Reproduktions- oder Nachweisbasis: `src/components/admin/reporting-dashboard.tsx`
- Erwartetes Verhalten: Gemischte Originalwaehrungen duerfen nicht als EUR-Summe dargestellt werden.
- Ist-Verhalten: KPI suggeriert eine fachlich belastbare EUR-Summe.
- Risiko / Auswirkung: irrefuehrende Management-Auswertung.
- Empfehlung: Kennzahl umbenennen oder nur `amountEur` aggregiert darstellen.
- Direkt behebbar: nein
- Status im Umsetzungsdurchgang: behoben

## Niedrig

### F-013
- ID: F-013
- Titel: README deckt Setup und Betriebsueberblick kaum ab
- Bereich: Dokumentation
- Schweregrad: niedrig
- Kategorie: Dokumentationsluecke
- Beschreibung: Die Root-Dokumentation besteht praktisch nur aus dem Projektnamen.
- Reproduktions- oder Nachweisbasis: `README.md`
- Erwartetes Verhalten: Einstieg in Setup, Architektur und wichtige Docs sollte von dort erreichbar sein.
- Ist-Verhalten: Einstieg fehlt.
- Risiko / Auswirkung: erschwerte Einarbeitung und unklare Betriebsbasis.
- Empfehlung: README als Einstiegspfad ausbauen.
- Direkt behebbar: ja
- Status im Umsetzungsdurchgang: behoben

### F-014
- ID: F-014
- Titel: Master-Data-Edit-UI ist technisch fragil
- Bereich: Admin / Wartbarkeit
- Schweregrad: niedrig
- Kategorie: technische Schuld / Wartbarkeitsproblem
- Beschreibung: Die Bearbeitung sammelt Formularwerte per DOM-Abfrage aus Tabellenzeilen statt ueber konsistente State-Modelle.
- Reproduktions- oder Nachweisbasis: `src/components/admin/master-data-manager.tsx`
- Erwartetes Verhalten: Editierlogik sollte typsicher und komponentenbasiert sein.
- Ist-Verhalten: DOM-getriebene Erfassung erschwert Erweiterung und Testbarkeit.
- Risiko / Auswirkung: Fehleranfaelligkeit bei kuenftigen UI-Aenderungen.
- Empfehlung: Bei naechster Ueberarbeitung auf gesteuerte Formularzustandslogik umstellen.
- Direkt behebbar: nein
