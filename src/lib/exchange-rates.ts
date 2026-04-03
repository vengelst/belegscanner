export type ExchangeRateResult = {
  rate: number;
  rateDate: string;
  targetCurrency: string;
};

type FrankfurterResponse = {
  amount: number;
  base: string;
  date: string;
  rates: Record<string, number>;
};

export async function fetchLatestExchangeRate(targetCurrency: string): Promise<ExchangeRateResult> {
  const normalizedCurrency = targetCurrency.trim().toUpperCase();
  if (!normalizedCurrency || normalizedCurrency === "EUR") {
    return {
      rate: 1,
      rateDate: new Date().toISOString().split("T")[0],
      targetCurrency: "EUR",
    };
  }

  const { env } = await import("@/lib/env");
  const baseUrl = env.EXCHANGE_RATE_API_URL.replace(/\/$/, "");
  const url = `${baseUrl}/latest?from=EUR&to=${encodeURIComponent(normalizedCurrency)}`;

  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Wechselkursdienst antwortete mit HTTP ${response.status}.`);
  }

  const data = await response.json() as FrankfurterResponse;
  const rate = data.rates?.[normalizedCurrency];

  if (typeof rate !== "number" || !isFinite(rate) || rate <= 0) {
    throw new Error(`Kein gueltiger Wechselkurs fuer ${normalizedCurrency} verfuegbar.`);
  }

  return {
    rate,
    rateDate: data.date,
    targetCurrency: normalizedCurrency,
  };
}

export function calculateAmountEur(amount: number, currency: string, exchangeRate: number | null): number {
  const normalizedCurrency = currency.trim().toUpperCase();
  if (normalizedCurrency === "EUR") return roundCurrency(amount);
  if (!exchangeRate || exchangeRate <= 0) return roundCurrency(amount);
  return roundCurrency(amount / exchangeRate);
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}
