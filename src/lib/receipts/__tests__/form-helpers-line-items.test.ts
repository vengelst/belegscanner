import { describe, expect, it } from "vitest";
import { recalculateAmountsFromLineItemSum } from "@/lib/receipts/form-helpers";

describe("recalculateAmountsFromLineItemSum", () => {
  it("skaliert Brutto/Netto/Steuer proportional aus dem Beleg", () => {
    const result = recalculateAmountsFromLineItemSum({
      activeSum: 59.5,
      allItemsSum: 119,
      reverseCharge: false,
      countryVatRatePercent: 19,
      receipt: { gross: 119, net: 100, tax: 19 },
    });

    expect(result.amount).toBe(59.5);
    expect(result.net).toBe(50);
    expect(result.tax).toBe(9.5);
    expect(result.source).toBe("receipt_scale");
  });

  it("behandelt Positionssummen als Netto, wenn sie dem Beleg-Netto entsprechen", () => {
    const result = recalculateAmountsFromLineItemSum({
      activeSum: 50,
      allItemsSum: 100,
      reverseCharge: false,
      countryVatRatePercent: null,
      receipt: { gross: 119, net: 100, tax: 19 },
    });

    expect(result.lineItemsAreNet).toBe(true);
    expect(result.net).toBe(50);
    expect(result.amount).toBe(59.5);
    expect(result.tax).toBe(9.5);
  });

  it("setzt bei Reverse Charge Steuer auf 0", () => {
    const result = recalculateAmountsFromLineItemSum({
      activeSum: 80,
      allItemsSum: 100,
      reverseCharge: true,
      countryVatRatePercent: 19,
      receipt: { gross: 100, net: 100, tax: 0 },
    });

    expect(result.amount).toBe(80);
    expect(result.net).toBe(80);
    expect(result.tax).toBe(0);
    expect(result.source).toBe("reverse_charge");
  });
});
