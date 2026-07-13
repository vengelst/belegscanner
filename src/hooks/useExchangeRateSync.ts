"use client";

import { useEffect, useState } from "react";
import { formatLocalizedNumber } from "@/lib/receipts/form-helpers";

export function useExchangeRateSync(currency: string, requiresExchangeRate: boolean) {
  const [exchangeRate, setExchangeRate] = useState("");
  const [exchangeRateDate, setExchangeRateDate] = useState("");
  const [exchangeRateLoading, setExchangeRateLoading] = useState(false);
  const [exchangeRateInfo, setExchangeRateInfo] = useState<string | null>(null);

  useEffect(() => {
    if (!requiresExchangeRate) {
      setExchangeRate("");
      setExchangeRateDate("");
      setExchangeRateInfo(null);
      setExchangeRateLoading(false);
      return;
    }

    let cancelled = false;
    setExchangeRateLoading(true);
    setExchangeRateInfo(null);

    fetch(`/api/exchange-rate?currency=${encodeURIComponent(currency.trim().toUpperCase())}`)
      .then(async (response) => {
        const data = await response.json().catch(() => null);
        if (!response.ok) {
          const message = data && typeof data === "object" && "error" in data ? String(data.error) : "Wechselkurs konnte nicht geladen werden.";
          throw new Error(message);
        }
        if (cancelled) return;
        const nextRate = typeof data.rate === "number" ? data.rate : null;
        const nextDate = typeof data.rateDate === "string" ? data.rateDate : "";
        if (nextRate !== null) setExchangeRate(formatLocalizedNumber(nextRate, 4));
        setExchangeRateDate(nextDate);
        setExchangeRateInfo(`Aktueller Wechselkurs fuer ${currency.trim().toUpperCase()} automatisch geladen.`);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : "Wechselkurs konnte nicht geladen werden.";
        setExchangeRateInfo(message);
      })
      .finally(() => {
        if (!cancelled) setExchangeRateLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [currency, requiresExchangeRate]);

  return {
    exchangeRate,
    exchangeRateDate,
    exchangeRateLoading,
    exchangeRateInfo,
    setExchangeRate,
    setExchangeRateDate,
  };
}
