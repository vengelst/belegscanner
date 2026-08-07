import { describe, it, expect } from "vitest";
import {
  DATEV_BELEGTYP_VALUES,
  datevBelegtypLabels,
  resolveDatevAddress,
  suggestDatevBelegtyp,
} from "@/lib/datev/belegtyp";

describe("suggestDatevBelegtyp", () => {
  it("schlaegt Rechnungsausgang bei Debitor vor", () => {
    expect(suggestDatevBelegtyp({ partyRole: "DEBTOR", categoryName: "Kasse" }))
      .toBe("RECHNUNGSAUSGANG");
  });

  it("schlaegt Kasse bei Kategorie 'Kasse' vor", () => {
    expect(suggestDatevBelegtyp({ partyRole: "CREDITOR", categoryName: "Kasse" })).toBe("KASSE");
  });

  it("erkennt Kategorien unabhaengig von Gross-/Kleinschreibung", () => {
    expect(suggestDatevBelegtyp({ partyRole: "CREDITOR", categoryName: "Barkasse Berlin" })).toBe("KASSE");
    expect(suggestDatevBelegtyp({ partyRole: "CREDITOR", categoryName: "KREDITKARTE Firma" }))
      .toBe("KREDITKARTENBELEGE");
    expect(suggestDatevBelegtyp({ partyRole: "CREDITOR", categoryName: "Reisekosten" })).toBe("REISEKOSTEN");
  });

  it("faellt auf Rechnungseingang zurueck", () => {
    expect(suggestDatevBelegtyp({ partyRole: "CREDITOR", categoryName: "EC-Karte" }))
      .toBe("RECHNUNGSEINGANG");
    expect(suggestDatevBelegtyp({})).toBe("RECHNUNGSEINGANG");
  });
});

describe("datevBelegtypLabels", () => {
  it("verwendet die DATEV-Anzeigenamen", () => {
    expect(datevBelegtypLabels.RECHNUNGSEINGANG).toBe("Rechnungseingang");
    expect(datevBelegtypLabels.RECHNUNGSAUSGANG).toBe("Rechnungsausgang");
    expect(datevBelegtypLabels.KASSE).toBe("Kasse");
    expect(datevBelegtypLabels.KREDITKARTENBELEGE).toBe("Kreditkartenbelege");
    expect(datevBelegtypLabels.SONSTIGE).toBe("Sonstige");
    expect(datevBelegtypLabels.REISEKOSTEN).toBe("DATEV Reisekosten-Belege");
  });

  it("hat fuer jeden Belegtyp ein Label", () => {
    for (const belegtyp of DATEV_BELEGTYP_VALUES) {
      expect(datevBelegtypLabels[belegtyp]).toBeTruthy();
    }
  });
});

describe("resolveDatevAddress", () => {
  const addresses = [
    { belegtyp: "KASSE" as const, datevAddress: "kasse@upload.datev.de" },
    { belegtyp: "RECHNUNGSEINGANG" as const, datevAddress: "eingang@upload.datev.de" },
  ];

  it("nimmt die Adresse des passenden Belegtyps", () => {
    const result = resolveDatevAddress({
      belegtyp: "KASSE",
      addresses,
      fallbackAddress: "standard@upload.datev.de",
    });
    expect(result).toEqual({ ok: true, address: "kasse@upload.datev.de", source: "belegtyp" });
  });

  it("bevorzugt die Typ-Adresse gegenueber dem Fallback bei Rechnungseingang", () => {
    const result = resolveDatevAddress({
      belegtyp: "RECHNUNGSEINGANG",
      addresses,
      fallbackAddress: "standard@upload.datev.de",
    });
    expect(result).toEqual({ ok: true, address: "eingang@upload.datev.de", source: "belegtyp" });
  });

  it("nutzt den Fallback nur fuer Rechnungseingang", () => {
    const result = resolveDatevAddress({
      belegtyp: "RECHNUNGSEINGANG",
      addresses: [],
      fallbackAddress: "standard@upload.datev.de",
    });
    expect(result).toEqual({ ok: true, address: "standard@upload.datev.de", source: "fallback" });
  });

  it("liefert einen Fehler fuer andere Belegtypen ohne eigene Adresse", () => {
    const result = resolveDatevAddress({
      belegtyp: "KREDITKARTENBELEGE",
      addresses,
      fallbackAddress: "standard@upload.datev.de",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("Kreditkartenbelege");
    }
  });

  it("ignoriert leere Adressen", () => {
    const result = resolveDatevAddress({
      belegtyp: "SONSTIGE",
      addresses: [{ belegtyp: "SONSTIGE", datevAddress: "   " }],
      fallbackAddress: "standard@upload.datev.de",
    });
    expect(result.ok).toBe(false);
  });

  it("liefert einen Fehler ohne Belegtyp", () => {
    const result = resolveDatevAddress({
      belegtyp: null,
      addresses,
      fallbackAddress: "standard@upload.datev.de",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("Kein DATEV-Belegtyp am Beleg gesetzt.");
    }
  });
});
