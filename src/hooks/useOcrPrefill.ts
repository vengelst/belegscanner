"use client";

import { useEffect } from "react";
import type { OcrResult } from "@/lib/document-analysis";
import type { OcrFieldKey } from "@/lib/receipts/field-review-states";

type SuggestedCountry = {
  id: string;
  confidence: string;
  currencyCode: string | null;
} | null;

type OcrPrefillSetters = {
  setDate: (v: string) => void;
  setDueDate: (v: string) => void;
  setServiceDate: (v: string) => void;
  setInvoiceNumber: (v: string) => void;
  setAmount: (v: string) => void;
  setNetAmount: (v: string) => void;
  setTaxAmount: (v: string) => void;
  setCurrency: (v: string) => void;
  setSupplier: (v: string) => void;
  setCountryId: (v: string) => void;
  setHospitalityLocation: (v: string) => void;
};

export function useOcrPrefill({
  ocrResult,
  manualOverrides,
  suggestedCountry,
  countryManuallyChanged,
  countryId,
  currency,
  isHospitality,
  hospitalityLocationManual,
  hospitalityLocation,
  setters,
}: {
  ocrResult: OcrResult | null;
  manualOverrides: Record<OcrFieldKey, boolean>;
  suggestedCountry: SuggestedCountry;
  countryManuallyChanged: boolean;
  countryId: string;
  currency: string;
  isHospitality: boolean;
  hospitalityLocationManual: boolean;
  hospitalityLocation: string;
  setters: OcrPrefillSetters;
}) {
  useEffect(() => {
    if (!ocrResult) return;
    const extracted = ocrResult.extracted;

    if (extracted.date && !manualOverrides.date) setters.setDate(extracted.date);
    if (!manualOverrides.dueDate) setters.setDueDate(extracted.dueDate ?? "");
    if (!manualOverrides.serviceDate) setters.setServiceDate(extracted.serviceDate ?? "");
    if (extracted.invoiceNumber && !manualOverrides.invoiceNumber) setters.setInvoiceNumber(extracted.invoiceNumber);
    if (extracted.amount !== null && !manualOverrides.amount) setters.setAmount(String(extracted.amount).replace(".", ","));
    if (extracted.netAmount !== null && !manualOverrides.netAmount) setters.setNetAmount(String(extracted.netAmount).replace(".", ","));
    if (extracted.taxAmount !== null && !manualOverrides.taxAmount) setters.setTaxAmount(String(extracted.taxAmount).replace(".", ","));
    if (extracted.currency && !manualOverrides.currency) setters.setCurrency(extracted.currency);
    if (extracted.supplier && !manualOverrides.supplier) setters.setSupplier(extracted.supplier);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manualOverrides, ocrResult]);

  useEffect(() => {
    if (!suggestedCountry || countryManuallyChanged || countryId) return;
    if (suggestedCountry.confidence === "high") {
      setters.setCountryId(suggestedCountry.id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countryId, countryManuallyChanged, suggestedCountry]);

  useEffect(() => {
    if (!suggestedCountry || !suggestedCountry.currencyCode) return;
    if (ocrResult?.extracted.currency || manualOverrides.currency) return;
    if (suggestedCountry.currencyCode !== "EUR" && currency === "EUR") {
      setters.setCurrency(suggestedCountry.currencyCode);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currency, manualOverrides.currency, ocrResult?.extracted.currency, suggestedCountry]);

  useEffect(() => {
    if (!ocrResult || !isHospitality || hospitalityLocationManual) return;
    const suggestedLocation = ocrResult.special.hospitality?.location ?? ocrResult.extracted.location;
    if (suggestedLocation && !hospitalityLocation) {
      setters.setHospitalityLocation(suggestedLocation);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hospitalityLocation, hospitalityLocationManual, isHospitality, ocrResult]);
}
