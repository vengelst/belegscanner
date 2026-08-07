# Claude Code – DATEV-Belegtyp Label + Default in Einstellungen

## Kontext

Repo: belegscanner. Kategorie ist UI-seitig schon raus; Feld heißt „DATEV-Belegtyp“.

## Anforderungen

1. **Feld-Beschriftung** in Erfassung/Edit/Filter/Liste:  
   Headline: **„DATEV-Belegtyp (Kategorie)“**  
   (DATEV-Belegtyp ist die Hauptbezeichnung, Kategorie nur in Klammern als Orientierung).

2. **Default immer Rechnungseingang** (Kreditor/Eingangsbeleg), sofern in den Einstellungen nichts anderes gewählt ist. Andere Typen wählt der User bewusst.  
   - Formular-Startwert = konfigurierbarer Org-Default (Fallback `RECHNUNGSEINGANG`)  
   - `suggestDatevBelegtyp`: wenn keine belastbare Erkennung → **nicht** `SONSTIGE`, sondern den konfigurierten Default (meist Rechnungseingang)

3. **Einstellungen** (Admin → Eigene Firma, neue Card unter/neben Firmenkarten):
   - **Standard-Belegtyp** (Select, Default Rechnungseingang) – wird bei jedem neuen Beleg vorausgewählt
   - **Bezeichnungen** je Belegtyp überschreibbar (Textfelder; leer = DATEV-Standardname)
   - Speichern über bestehende Organization-API erweitern

## Datenmodell

`OrganizationProfile` erweitern:

```prisma
defaultDatevBelegtyp        DatevBelegtyp @default(RECHNUNGSEINGANG)
datevBelegtypLabelOverrides Json?  // Record<DatevBelegtyp, string> nur gesetzte Overrides
```

Migration + Seed: Default Rechnungseingang, Overrides leer.

## Code

- `src/lib/datev/belegtyp.ts`:  
  - `resolveDatevBelegtypLabel(typ, overrides?)`  
  - `suggestDatevBelegtyp(..., { defaultBelegtyp?: DatevBelegtyp })` → Fallback = default statt SONSTIGE  
- Organization DTO + API PUT um neue Felder  
- Neue Form-Komponente z. B. `datev-belegtyp-settings-form.tsx`  
- Create/Edit: Labels aus Org laden; Startwert = `defaultDatevBelegtyp`  
- Filter/Liste: aufgelöste Labels nutzen wo sinnvoll (Server kann Labels mitgeben oder Client lädt Defaults)

## Tests

- Fallback Suggestion → Default Rechnungseingang  
- Label-Override greift  

## Done

Commit auf main. Deploy/Migrate Cursor.
