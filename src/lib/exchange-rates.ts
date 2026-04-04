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

type OpenErApiResponse = {
  result: string;
  time_last_update_utc?: string;
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
  const providers = [
    () => fetchFromFrankfurter(env.EXCHANGE_RATE_API_URL, normalizedCurrency),
    () => fetchFromOpenErApi(normalizedCurrency),
  ];

  const errors: string[] = [];

  for (const provider of providers) {
    try {
      return await provider();
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "Unbekannter Wechselkursfehler.");
    }
  }

  throw new Error(errors[0] ?? `Kein gueltiger Wechselkurs fuer ${normalizedCurrency} verfuegbar.`);
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

async function fetchFromFrankfurter(baseUrl: string, targetCurrency: string): Promise<ExchangeRateResult> {
  const url = `${baseUrl.replace(/\/$/, "")}/latest?from=EUR&to=${encodeURIComponent(targetCurrency)}`;
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Frankfurter antwortete mit HTTP ${response.status}.`);
  }

  const data = await response.json() as FrankfurterResponse;
  return buildExchangeRateResult(data.rates?.[targetCurrency], data.date, targetCurrency);
}

async function fetchFromOpenErApi(targetCurrency: string): Promise<ExchangeRateResult> {
  const response = await fetch("https://open.er-api.com/v6/latest/EUR", {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Fallback-Wechselkursdienst antwortete mit HTTP ${response.status}.`);
  }

  const data = await response.json() as OpenErApiResponse;
  if (data.result !== "success") {
    throw new Error("Fallback-Wechselkursdienst lieferte keine gueltige Antwort.");
  }

  const rateDate = data.time_last_update_utc
    ? new Date(data.time_last_update_utc).toISOString().split("T")[0]
    : new Date().toISOString().split("T")[0];

  return buildExchangeRateResult(data.rates?.[targetCurrency], rateDate, targetCurrency);
}

function buildExchangeRateResult(rate: number | undefined, rateDate: string, targetCurrency: string): ExchangeRateResult {
  if (typeof rate !== "number" || !isFinite(rate) || rate <= 0) {
    throw new Error(`Kein gueltiger Wechselkurs fuer ${targetCurrency} verfuegbar.`);
  }

  return {
    rate,
    rateDate,
    targetCurrency,
  };
}
