import { describe, expect, it } from "vitest";
import {
  extractAmounts,
  parseAmountFromLine,
  parseAmountValue,
  reconcileAmounts,
} from "@/lib/ocr";

describe("parseAmountValue – EU/US Formate", () => {
  it("EU: Punkt=Tausender, Komma=Dezimal", () => {
    expect(parseAmountValue("1.234,56")).toBe(1234.56);
    expect(parseAmountValue("1.234.567,89")).toBe(1234567.89);
    expect(parseAmountValue("12,50")).toBe(12.5);
    expect(parseAmountValue("0,99")).toBe(0.99);
  });

  it("US: Komma=Tausender, Punkt=Dezimal", () => {
    expect(parseAmountValue("1,234.56")).toBe(1234.56);
    expect(parseAmountValue("1,234,567.89")).toBe(1234567.89);
    expect(parseAmountValue("12.50")).toBe(12.5);
  });

  it("unterscheidet 1.234 (Tausenderpunkt) von 1.234,00 (EU)", () => {
    expect(parseAmountValue("1.234")).toBe(1234);
    expect(parseAmountValue("1.234,00")).toBe(1234);
    // Wert-Gleichheit, aber der Punkt-only-Fall darf nicht 1.234 (=eins-komma-...) werden
    expect(parseAmountValue("1.234")).not.toBe(1.234);
  });

  it("Dezimalpunkt mit 1-2 Nachkommastellen bleibt Dezimal", () => {
    expect(parseAmountValue("12.50")).toBe(12.5);
    expect(parseAmountValue("9.9")).toBe(9.9);
    expect(parseAmountValue("1.5")).toBe(1.5);
  });

  it("fuehrende Null => Dezimal, nicht Tausender", () => {
    expect(parseAmountValue("0.500")).toBe(0.5);
  });

  it("mehrere Tausenderpunkte ohne Komma", () => {
    expect(parseAmountValue("1.234.567")).toBe(1234567);
    expect(parseAmountValue("12.345")).toBe(12345);
  });

  it("Waehrungssymbole und Text werden ignoriert", () => {
    expect(parseAmountValue("EUR 1.234,56")).toBe(1234.56);
    expect(parseAmountValue("€ 19,99")).toBe(19.99);
    expect(parseAmountValue("$1,299.00")).toBe(1299);
    expect(parseAmountValue("1.234,56 €")).toBe(1234.56);
  });

  it("negative Betraege und Ungueltiges", () => {
    expect(parseAmountValue("-19,99")).toBe(-19.99);
    expect(parseAmountValue("")).toBeNull();
    expect(parseAmountValue(null)).toBeNull();
    expect(parseAmountValue("abc")).toBeNull();
  });
});

describe("parseAmountFromLine", () => {
  it("nimmt standardmaessig das letzte Zahl-Token der Zeile", () => {
    expect(parseAmountFromLine("Gesamtbetrag EUR 1.234,56")).toBe(1234.56);
    expect(parseAmountFromLine("2 x 4,50    9,00")).toBe(9);
  });

  it("optional das Maximum", () => {
    expect(parseAmountFromLine("3,00 100,00 7,50", { prefer: "max" })).toBe(100);
  });

  it("Zeile ohne Zahl => null", () => {
    expect(parseAmountFromLine("Vielen Dank fuer Ihren Einkauf")).toBeNull();
  });
});

describe("extractAmounts – Zwischensumme vs Gesamt", () => {
  it("bevorzugt Gesamtbetrag und nutzt Zwischensumme nie als Gesamt", () => {
    const text = [
      "Artikel A            10,00",
      "Artikel B            5,00",
      "Zwischensumme        15,00",
      "MwSt 19%             2,85",
      "Gesamtbetrag         17,85",
    ].join("\n");

    const amounts = extractAmounts(text);
    expect(amounts.grossAmount).toBe(17.85);
    expect(amounts.subtotalAmount).toBe(15);
    expect(amounts.taxAmount).toBe(2.85);
    expect(amounts.grossAmount).not.toBe(amounts.subtotalAmount);
  });

  it("hoehere Prioritaet: Zahlbetrag schlaegt allgemeines 'Summe'", () => {
    const text = [
      "Summe                90,00",
      "Zu zahlen           100,00",
    ].join("\n");
    expect(extractAmounts(text).grossAmount).toBe(100);
  });

  it("erkennt Netto und Steuer separat", () => {
    const text = [
      "Nettobetrag          100,00",
      "MwSt 19 %             19,00",
      "Rechnungsbetrag      119,00",
    ].join("\n");
    const a = extractAmounts(text);
    expect(a.netAmount).toBe(100);
    expect(a.taxAmount).toBe(19);
    expect(a.grossAmount).toBe(119);
  });

  it("EU-Tausender im Gesamtbetrag", () => {
    const text = ["Gesamtbetrag  1.234,56 EUR"].join("\n");
    expect(extractAmounts(text).grossAmount).toBe(1234.56);
  });

  it("leerer Text => alles null", () => {
    const a = extractAmounts("");
    expect(a.grossAmount).toBeNull();
    expect(a.subtotalAmount).toBeNull();
  });
});

describe("reconcileAmounts – konservative Korrektur", () => {
  it("ergaenzt fehlenden OpenAI-Gesamtbetrag aus dem Rohtext", () => {
    const text = "Gesamtbetrag 42,00";
    const r = reconcileAmounts({ grossAmount: null, netAmount: null, taxAmount: null }, text);
    expect(r.grossAmount).toBe(42);
    expect(r.corrections.length).toBeGreaterThan(0);
  });

  it("korrigiert Zwischensumme, die faelschlich als Gesamt erkannt wurde", () => {
    const text = [
      "Zwischensumme  15,00",
      "MwSt 19%        2,85",
      "Gesamtbetrag   17,85",
    ].join("\n");
    const r = reconcileAmounts({ grossAmount: 15, netAmount: null, taxAmount: null }, text);
    expect(r.grossAmount).toBe(17.85);
    expect(r.corrections.length).toBeGreaterThan(0);
  });

  it("laesst korrekten OpenAI-Gesamtbetrag unveraendert (keine Regression)", () => {
    const text = [
      "Zwischensumme  15,00",
      "Gesamtbetrag   17,85",
    ].join("\n");
    const r = reconcileAmounts({ grossAmount: 17.85, netAmount: 15, taxAmount: 2.85 }, text);
    expect(r.grossAmount).toBe(17.85);
    expect(r.netAmount).toBe(15);
    expect(r.taxAmount).toBe(2.85);
    expect(r.corrections.length).toBe(0);
  });

  it("ohne Rohtext bleibt alles unveraendert", () => {
    const r = reconcileAmounts({ grossAmount: 50, netAmount: null, taxAmount: null }, null);
    expect(r.grossAmount).toBe(50);
    expect(r.corrections.length).toBe(0);
  });
});
