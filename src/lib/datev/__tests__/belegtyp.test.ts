import { describe, it, expect } from "vitest";
import {
  DATEV_BELEGTYP_VALUES,
  datevBelegtypLabel,
  datevBelegtypLabels,
  matchesCompanyCard,
  normalizeCardLastDigits,
  normalizeDatevBelegtypLabelOverrides,
  resolveDatevAddress,
  resolveDatevBelegtypLabel,
  resolveDatevBelegtypLabels,
  suggestDatevBelegtyp,
} from "@/lib/datev/belegtyp";

const COMPANY_CARDS = ["2454", "2350"];

describe("normalizeCardLastDigits", () => {
  it("reduziert auf reine Ziffern", () => {
    expect(normalizeCardLastDigits("**** 2454")).toBe("2454");
    expect(normalizeCardLastDigits("XXXX-2350")).toBe("2350");
    expect(normalizeCardLastDigits(null)).toBe("");
  });
});

describe("matchesCompanyCard", () => {
  it("erkennt die hinterlegten Firmenkarten", () => {
    expect(matchesCompanyCard("2454", COMPANY_CARDS)).toBe(true);
    expect(matchesCompanyCard("**** 2350", COMPANY_CARDS)).toBe(true);
  });

  it("lehnt fremde Karten ab", () => {
    expect(matchesCompanyCard("9999", COMPANY_CARDS)).toBe(false);
    expect(matchesCompanyCard("", COMPANY_CARDS)).toBe(false);
    expect(matchesCompanyCard("2454", [])).toBe(false);
  });

  it("matcht laengere OCR-Ziffern per Suffix", () => {
    expect(matchesCompanyCard("512454", COMPANY_CARDS)).toBe(true);
  });

  it("matcht zu kurze Ziffern nicht per Suffix", () => {
    expect(matchesCompanyCard("54", COMPANY_CARDS)).toBe(false);
    expect(matchesCompanyCard("454", COMPANY_CARDS)).toBe(false);
  });

  it("matcht kurze hinterlegte Endziffern nur exakt", () => {
    expect(matchesCompanyCard("54", ["54"])).toBe(true);
    expect(matchesCompanyCard("2454", ["54"])).toBe(false);
  });
});

describe("suggestDatevBelegtyp", () => {
  it("schlaegt Rechnungsausgang bei Debitor vor", () => {
    expect(suggestDatevBelegtyp({ partyRole: "DEBTOR", paymentMethod: "cash" }))
      .toBe("RECHNUNGSAUSGANG");
  });

  it("schlaegt Kreditkartenbelege bei Firmenkarte vor", () => {
    expect(suggestDatevBelegtyp({
      partyRole: "CREDITOR",
      paymentMethod: "visa",
      cardLastDigits: "2454",
      companyCardLastDigits: COMPANY_CARDS,
    })).toBe("KREDITKARTENBELEGE");

    expect(suggestDatevBelegtyp({
      partyRole: "CREDITOR",
      paymentMethod: "mastercard",
      cardLastDigits: "2350",
      companyCardLastDigits: COMPANY_CARDS,
    })).toBe("KREDITKARTENBELEGE");
  });

  it("schlaegt Kasse bei fremder Karte vor (privat verauslagt)", () => {
    expect(suggestDatevBelegtyp({
      partyRole: "CREDITOR",
      paymentMethod: "credit_card",
      cardLastDigits: "9999",
      companyCardLastDigits: COMPANY_CARDS,
    })).toBe("KASSE");
  });

  it("schlaegt Kasse bei Kartenzahlung ohne erkennbare Endziffern vor", () => {
    expect(suggestDatevBelegtyp({
      partyRole: "CREDITOR",
      paymentMethod: "debit_card",
      companyCardLastDigits: COMPANY_CARDS,
    })).toBe("KASSE");
  });

  it("wertet erkannte Kartenendziffern auch ohne Zahlungsart aus", () => {
    expect(suggestDatevBelegtyp({
      cardLastDigits: "2454",
      companyCardLastDigits: COMPANY_CARDS,
    })).toBe("KREDITKARTENBELEGE");
  });

  it("schlaegt Kasse bei Barzahlung vor", () => {
    expect(suggestDatevBelegtyp({ partyRole: "CREDITOR", paymentMethod: "cash" })).toBe("KASSE");
  });

  it("schlaegt Rechnungseingang bei Bewirtung vor", () => {
    expect(suggestDatevBelegtyp({ documentType: "hospitality" })).toBe("RECHNUNGSEINGANG");
  });

  it("faellt auf Rechnungseingang zurueck", () => {
    expect(suggestDatevBelegtyp({ partyRole: "CREDITOR" })).toBe("RECHNUNGSEINGANG");
    expect(suggestDatevBelegtyp({ paymentMethod: "bank_transfer" })).toBe("RECHNUNGSEINGANG");
    expect(suggestDatevBelegtyp({ documentType: "fuel" })).toBe("RECHNUNGSEINGANG");
  });

  it("faellt ohne belastbare Erkennung auf den Standard-Belegtyp zurueck", () => {
    expect(suggestDatevBelegtyp({})).toBe("RECHNUNGSEINGANG");
    expect(suggestDatevBelegtyp({ paymentMethod: "unknown", documentType: "general" })).toBe("RECHNUNGSEINGANG");
  });

  it("nutzt den konfigurierten Standard-Belegtyp statt Rechnungseingang", () => {
    expect(suggestDatevBelegtyp({}, { defaultBelegtyp: "KASSE" })).toBe("KASSE");
    expect(suggestDatevBelegtyp({ paymentMethod: "unknown" }, { defaultBelegtyp: "SONSTIGE" })).toBe("SONSTIGE");
  });

  it("laesst den Standard-Belegtyp die Erkennung nicht ueberstimmen", () => {
    expect(suggestDatevBelegtyp({ partyRole: "DEBTOR" }, { defaultBelegtyp: "KASSE" })).toBe("RECHNUNGSAUSGANG");
    expect(suggestDatevBelegtyp({ paymentMethod: "cash" }, { defaultBelegtyp: "SONSTIGE" })).toBe("KASSE");
    expect(suggestDatevBelegtyp({ partyRole: "CREDITOR" }, { defaultBelegtyp: "KASSE" })).toBe("RECHNUNGSEINGANG");
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

describe("resolveDatevBelegtypLabel", () => {
  it("nutzt den DATEV-Standardnamen ohne eigene Bezeichnung", () => {
    expect(resolveDatevBelegtypLabel("RECHNUNGSEINGANG")).toBe("Rechnungseingang");
    expect(resolveDatevBelegtypLabel("KASSE", {})).toBe("Kasse");
    expect(resolveDatevBelegtypLabel("KASSE", null)).toBe("Kasse");
  });

  it("bevorzugt die eigene Bezeichnung", () => {
    expect(resolveDatevBelegtypLabel("RECHNUNGSEINGANG", { RECHNUNGSEINGANG: "Eingangsrechnungen" }))
      .toBe("Eingangsrechnungen");
  });

  it("faellt bei leerer Bezeichnung auf den Standardnamen zurueck", () => {
    expect(resolveDatevBelegtypLabel("KASSE", { KASSE: "   " })).toBe("Kasse");
  });

  it("loest alle Belegtypen auf und laesst nicht ueberschriebene unveraendert", () => {
    const labels = resolveDatevBelegtypLabels({ KASSE: "Barkasse" });
    expect(labels.KASSE).toBe("Barkasse");
    expect(labels.RECHNUNGSEINGANG).toBe("Rechnungseingang");
    for (const belegtyp of DATEV_BELEGTYP_VALUES) {
      expect(labels[belegtyp]).toBeTruthy();
    }
  });

  it("greift auch in datevBelegtypLabel", () => {
    expect(datevBelegtypLabel("KASSE", { KASSE: "Barkasse" })).toBe("Barkasse");
    expect(datevBelegtypLabel("KASSE")).toBe("Kasse");
    expect(datevBelegtypLabel("UNBEKANNT", { KASSE: "Barkasse" })).toBeNull();
  });
});

describe("normalizeDatevBelegtypLabelOverrides", () => {
  it("behaelt nur bekannte Belegtypen mit nicht-leerem Namen", () => {
    expect(normalizeDatevBelegtypLabelOverrides({
      KASSE: "  Barkasse  ",
      RECHNUNGSEINGANG: "   ",
      UNBEKANNT: "Irgendwas",
      SONSTIGE: 42,
    })).toEqual({ KASSE: "Barkasse" });
  });

  it("verkraftet fehlende und unpassende Werte", () => {
    expect(normalizeDatevBelegtypLabelOverrides(null)).toEqual({});
    expect(normalizeDatevBelegtypLabelOverrides(undefined)).toEqual({});
    expect(normalizeDatevBelegtypLabelOverrides("KASSE")).toEqual({});
    expect(normalizeDatevBelegtypLabelOverrides(["KASSE"])).toEqual({});
  });
});
