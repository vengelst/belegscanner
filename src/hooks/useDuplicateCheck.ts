import { useCallback, useRef, useState } from "react";
import type { DuplicateCandidate } from "@/lib/receipts/duplicate-check";

type DuplicateCheckInput = {
  date: string;
  amount: string;
  supplier: string;
  invoiceNumber?: string;
  excludeReceiptId?: string;
};

export function useDuplicateCheck() {
  const [candidates, setCandidates] = useState<DuplicateCandidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const check = useCallback((input: DuplicateCheckInput) => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    const parsedAmount = parseFloat(input.amount.replace(",", "."));
    if (!input.date || isNaN(parsedAmount) || parsedAmount <= 0) {
      setCandidates([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch("/api/receipts/duplicates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            date: input.date,
            amount: parsedAmount,
            supplier: input.supplier || null,
            invoiceNumber: input.invoiceNumber || null,
            excludeReceiptId: input.excludeReceiptId || undefined,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          setCandidates(data.candidates ?? []);
          setDismissed(false);
        } else {
          setCandidates([]);
        }
      } catch {
        setCandidates([]);
      } finally {
        setLoading(false);
      }
    }, 600);
  }, []);

  const dismiss = useCallback(() => {
    setDismissed(true);
  }, []);

  const reset = useCallback(() => {
    setCandidates([]);
    setDismissed(false);
  }, []);

  return {
    candidates,
    loading,
    dismissed,
    check,
    dismiss,
    reset,
    hasDuplicates: candidates.length > 0 && !dismissed,
  };
}
