"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { OcrResult } from "@/lib/document-analysis";
import { CameraCapture } from "@/components/receipts/camera-capture";
import { createReceiptWorkingImage, type ReceiptImageProcessingResult } from "@/lib/receipt-image-processing";
import type { DocumentDetectionResult } from "@/components/receipts/document-detector";
import { documentTypeLabels, toReceiptDocumentType } from "@/lib/ocr-suggestions";
import { useExchangeRateSync } from "@/hooks/useExchangeRateSync";
import { useOcrPrefill } from "@/hooks/useOcrPrefill";
import { useSelectionPrefill } from "@/hooks/useSelectionPrefill";
import { buildFieldReviewStates, buildStructuredData, hasDetectedOcrValues, type OcrFieldKey } from "@/lib/receipts/field-review-states";
import {
  buildCurrencyOptions,
  formatLocalizedNumber,
  getApiErrorMessage,
  parseLocalizedNumber,
  recalculateAmountsFromLineItemSum,
  splitGrossByVatRate,
  sumActiveLineItems,
  type CaptureSource,
  type CaptureTrigger,
  type Purpose,
  type Country,
  type Vehicle,
  type UserDefaults,
} from "@/lib/receipts/form-helpers";
import { suggestDatevBelegtyp, type DatevBelegtyp } from "@/lib/datev/belegtyp";
import { ReceiptFormFileSection } from "@/components/receipts/receipt-form-file-section";
import { ReceiptFormDataSection } from "@/components/receipts/receipt-form-data-section";
import { ReceiptFormAssignmentSection } from "@/components/receipts/receipt-form-assignment-section";
import { ReceiptFormHospitalitySection } from "@/components/receipts/receipt-form-hospitality-section";
import { ReceiptFormActions } from "@/components/receipts/receipt-form-actions";
import { DuplicateWarning } from "@/components/receipts/duplicate-warning";
import { useDuplicateCheck } from "@/hooks/useDuplicateCheck";

function formatAmountInput(value: number): string {
  return value.toFixed(2).replace(".", ",");
}

function todayIsoDate(): string {
  return new Date().toISOString().split("T")[0];
}

const EMPTY_MANUAL_OVERRIDES: Record<OcrFieldKey, boolean> = {
  date: false,
  dueDate: false,
  serviceDate: false,
  invoiceNumber: false,
  amount: false,
  grossAmount: false,
  netAmount: false,
  taxAmount: false,
  currency: false,
  supplier: false,
};

type Props = {
  purposes: Purpose[];
  countries: Country[];
  vehicles: Vehicle[];
  userDefaults: UserDefaults;
  /** Endziffern der Firmenkarten aus den Organisationseinstellungen. */
  companyCardLastDigits: string[];
};

export function ReceiptForm({ purposes, countries, vehicles, userDefaults, companyCardLastDigits }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [captureSource, setCaptureSource] = useState<CaptureSource | null>(null);
  const [captureTrigger, setCaptureTrigger] = useState<CaptureTrigger | null>(null);
  const [workingImageInfo, setWorkingImageInfo] = useState<ReceiptImageProcessingResult | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraSupported, setCameraSupported] = useState(false);
  const [isPreparingAsset, setIsPreparingAsset] = useState(false);
  const [ocrRunning, setOcrRunning] = useState(false);
  const [ocrResult, setOcrResult] = useState<OcrResult | null>(null);

  const today = todayIsoDate();
  const [date, setDate] = useState(today);
  const [partyRole, setPartyRole] = useState<"CREDITOR" | "DEBTOR">("CREDITOR");
  const [partyRoleManuallyChanged, setPartyRoleManuallyChanged] = useState(false);
  const [dueDate, setDueDate] = useState("");
  const [serviceDate, setServiceDate] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [amount, setAmount] = useState("");
  const [netAmount, setNetAmount] = useState("");
  const [taxAmount, setTaxAmount] = useState("");
  const [reverseCharge, setReverseCharge] = useState(false);
  const [vatRatePercent, setVatRatePercent] = useState<number | null>(null);
  const [currency, setCurrency] = useState("EUR");
  const [supplier, setSupplier] = useState("");
  const [countryManuallyChanged, setCountryManuallyChanged] = useState(false);
  const [occasion, setOccasion] = useState("");
  const [guests, setGuests] = useState("");
  const [hospitalityLocation, setHospitalityLocation] = useState("");
  const [datevBelegtyp, setDatevBelegtyp] = useState<DatevBelegtyp>("RECHNUNGSEINGANG");
  const [datevBelegtypManuallyChanged, setDatevBelegtypManuallyChanged] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lineItemNotice, setLineItemNotice] = useState<string | null>(null);
  const [manualOverrides, setManualOverrides] = useState<Record<OcrFieldKey, boolean>>(EMPTY_MANUAL_OVERRIDES);
  const [hospitalityLocationManual, setHospitalityLocationManual] = useState(false);

  const validIds = useMemo(() => ({
    purposes: new Set(purposes.map((purpose) => purpose.id)),
    countries: new Set(countries.map((country) => country.id)),
    vehicles: new Set(vehicles.map((vehicle) => vehicle.id)),
  }), [countries, purposes, vehicles]);

  const {
    purposeId, countryId, vehicleId, prefillSource,
    setPurposeId, setCountryId, setVehicleId, resetSelection,
  } = useSelectionPrefill(userDefaults, validIds);

  const selectedPurpose = purposes.find((purpose) => purpose.id === purposeId);
  const isHospitality = selectedPurpose?.isHospitality ?? false;
  const requiresExchangeRate = currency.trim().toUpperCase() !== "EUR";
  const normalizedCurrency = currency.trim().toUpperCase() || "EUR";
  const currencyOptions = useMemo(() => buildCurrencyOptions(countries), [countries]);

  const {
    exchangeRate, exchangeRateDate, exchangeRateLoading, exchangeRateInfo,
    setExchangeRate, setExchangeRateDate,
  } = useExchangeRateSync(currency, requiresExchangeRate);

  const amountEurPreview = useMemo(() => {
    const parsedAmount = parseLocalizedNumber(amount);
    const parsedRate = parseLocalizedNumber(exchangeRate);
    if (parsedAmount === null) return "";
    if (!requiresExchangeRate) return formatLocalizedNumber(parsedAmount);
    if (parsedRate === null || parsedRate <= 0) return "";
    return formatLocalizedNumber(parsedAmount / parsedRate);
  }, [amount, exchangeRate, requiresExchangeRate]);

  const suggestedCountry = useMemo(() => {
    const code = ocrResult?.extracted.countryCode?.toUpperCase();
    const name = ocrResult?.extracted.countryName?.toLowerCase();
    const confidence = ocrResult?.fieldConfidence.country ?? "none";
    if (!code && !name) return null;

    const matched = countries.find((country) => {
      const countryCode = country.code?.toUpperCase();
      const countryName = country.name.toLowerCase();
      return (code && countryCode === code) || (name && countryName.includes(name));
    });

    if (!matched) return null;
    return {
      id: matched.id,
      label: matched.name,
      reason: ocrResult?.extracted.countryName ?? matched.name,
      confidence,
      currencyCode: matched.currencyCode,
    };
  }, [countries, ocrResult?.extracted.countryCode, ocrResult?.extracted.countryName, ocrResult?.fieldConfidence.country]);

  const suggestedPurpose = useMemo(() => {
    const documentType = ocrResult?.extracted.documentType;
    if (!documentType || documentType === "general") return null;

    if (documentType === "hospitality") {
      const hospitalityPurpose = purposes.find((purpose) => purpose.isHospitality);
      if (hospitalityPurpose) {
        return { id: hospitalityPurpose.id, label: hospitalityPurpose.name, reason: documentTypeLabels.hospitality };
      }
    }

    if (documentType === "fuel") {
      const fuelPurpose = purposes.find((purpose) => /tank/i.test(purpose.name));
      if (fuelPurpose) {
        return { id: fuelPurpose.id, label: fuelPurpose.name, reason: documentTypeLabels.fuel };
      }
    }

    if (documentType === "lodging") {
      const lodgingPurpose = purposes.find((purpose) => /unterkunft|hotel/i.test(purpose.name));
      if (lodgingPurpose) {
        return { id: lodgingPurpose.id, label: lodgingPurpose.name, reason: documentTypeLabels.lodging };
      }
    }

    if (documentType === "parking") {
      const parkingPurpose = purposes.find((purpose) => /park/i.test(purpose.name));
      if (parkingPurpose) {
        return { id: parkingPurpose.id, label: parkingPurpose.name, reason: documentTypeLabels.parking };
      }
    }

    if (documentType === "toll") {
      const tollPurpose = purposes.find((purpose) => /maut|toll/i.test(purpose.name));
      if (tollPurpose) {
        return { id: tollPurpose.id, label: tollPurpose.name, reason: documentTypeLabels.toll };
      }
    }

    return null;
  }, [ocrResult?.extracted.documentType, purposes]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof navigator === "undefined") return;
    const secure = window.isSecureContext || ["localhost", "127.0.0.1"].includes(window.location.hostname);
    setCameraSupported(secure && !!navigator.mediaDevices?.getUserMedia);
  }, []);

  /**
   * DATEV-Belegtyp aus Belegrichtung und Belegerkennung vorbelegen (Zahlungsart,
   * Kartenendziffern, Belegart). Sobald der Nutzer den Typ selbst gewaehlt hat,
   * wird der Vorschlag nicht mehr angewendet.
   */
  useEffect(() => {
    if (datevBelegtypManuallyChanged) return;
    setDatevBelegtyp(suggestDatevBelegtyp({
      // Die Belegrichtung zaehlt nur als Signal, wenn sie erkannt oder bewusst
      // gesetzt wurde - der Formular-Startwert CREDITOR ist keine Aussage.
      partyRole: partyRoleManuallyChanged ? partyRole : ocrResult?.extracted.partyRole ?? null,
      paymentMethod: ocrResult?.extracted.paymentMethod ?? null,
      cardLastDigits: ocrResult?.extracted.cardLastDigits ?? null,
      documentType: ocrResult?.extracted.documentType ?? null,
      companyCardLastDigits,
    }));
  }, [
    partyRole,
    partyRoleManuallyChanged,
    ocrResult?.extracted.partyRole,
    datevBelegtypManuallyChanged,
    companyCardLastDigits,
    ocrResult?.extracted.paymentMethod,
    ocrResult?.extracted.cardLastDigits,
    ocrResult?.extracted.documentType,
  ]);

  function markManualOverride(field: OcrFieldKey) {
    setManualOverrides((current) => (current[field] ? current : { ...current, [field]: true }));
  }

  /**
   * Landwechsel durch den Nutzer: Netto und Steuer duerfen danach wieder aus
   * dem Bruttobetrag abgeleitet werden.
   */
  function changeCountry(value: string) {
    setManualOverrides((current) => ({ ...current, netAmount: false, taxAmount: false }));
    setCountryManuallyChanged(true);
    setCountryId(value);
  }

  /** Setzt das komplette Formular auf einen leeren Neubeleg zurueck. */
  function resetForm() {
    setOriginalFile(null);
    setPreviewUrl(null);
    setCaptureSource(null);
    setCaptureTrigger(null);
    setWorkingImageInfo(null);
    setIsPreparingAsset(false);
    setOcrRunning(false);
    setOcrResult(null);
    setDate(todayIsoDate());
    setPartyRole("CREDITOR");
    setPartyRoleManuallyChanged(false);
    setDueDate("");
    setServiceDate("");
    setInvoiceNumber("");
    setAmount("");
    setNetAmount("");
    setTaxAmount("");
    setReverseCharge(false);
    setVatRatePercent(null);
    setCurrency("EUR");
    setSupplier("");
    setCountryManuallyChanged(false);
    setOccasion("");
    setGuests("");
    setHospitalityLocation("");
    setHospitalityLocationManual(false);
    setDatevBelegtyp("RECHNUNGSEINGANG");
    setDatevBelegtypManuallyChanged(false);
    setManualOverrides(EMPTY_MANUAL_OVERRIDES);
    setError(null);
    setLineItemNotice(null);
    duplicateCheck.reset();
    resetSelection();
  }

  /**
   * Uebernimmt die Summe der aktiven Positionen und setzt Betrag, Netto und MwSt
   * anhand der Beleg-Summen (OCR) bzw. des Laender-Steuersatzes neu.
   */
  function applyGrossFromLineItems(
    summary: { activeCount: number; totalCount: number; activeSum: number | null },
    allItemsSum: number | null,
  ) {
    if (summary.activeCount === 0) {
      setAmount(formatAmountInput(0));
      setNetAmount(formatAmountInput(0));
      setTaxAmount(formatAmountInput(0));
      setVatRatePercent(null);
      setManualOverrides((current) => ({ ...current, amount: true, grossAmount: true, netAmount: true, taxAmount: true }));
      setLineItemNotice("Alle Positionen sind deaktiviert. Betrag, Netto und Steuer stehen auf 0,00 - der Beleg kann so nicht gespeichert werden.");
      return;
    }

    if (summary.activeSum === null) {
      setLineItemNotice("Keine der aktiven Positionen hat einen erkannten Betrag. Der Rechnungsbetrag wurde nicht veraendert und muss manuell geprueft werden.");
      return;
    }

    const selectedCountry = countries.find((country) => country.id === countryId);
    const extracted = ocrResult?.extracted;
    const recalc = recalculateAmountsFromLineItemSum({
      activeSum: summary.activeSum,
      allItemsSum,
      reverseCharge,
      countryVatRatePercent: selectedCountry?.vatRatePercent ?? null,
      receipt: {
        gross: extracted?.grossAmount ?? extracted?.amount ?? null,
        net: extracted?.netAmount ?? null,
        tax: extracted?.taxAmount ?? null,
      },
    });

    setAmount(formatAmountInput(recalc.amount));
    setNetAmount(formatAmountInput(recalc.net));
    setTaxAmount(formatAmountInput(recalc.tax));
    setVatRatePercent(reverseCharge ? null : recalc.vatRatePercent);
    setManualOverrides((current) => ({ ...current, amount: true, grossAmount: true, netAmount: true, taxAmount: true }));

    const basisHint = recalc.lineItemsAreNet ? "Positionen als Netto erkannt" : "MwSt aus Beleg/Land";
    setLineItemNotice(
      `Betrag, Netto und Steuer aus ${summary.activeCount} von ${summary.totalCount} Positionen neu berechnet (${basisHint}).`,
    );
  }

  function toggleInvoiceLineItem(index: number) {
    const invoice = ocrResult?.special.invoice;
    if (!ocrResult || !invoice) return;

    const lineItems = invoice.lineItems.map((item, itemIndex) => (
      itemIndex === index ? { ...item, excluded: !(item.excluded ?? false) } : item
    ));

    setOcrResult({ ...ocrResult, special: { ...ocrResult.special, invoice: { ...invoice, lineItems } } });
    const active = sumActiveLineItems(lineItems, (item) => item.totalPrice);
    const all = sumActiveLineItems(
      lineItems.map((item) => ({ ...item, excluded: false })),
      (item) => item.totalPrice,
    );
    applyGrossFromLineItems(active, all.activeSum);
  }

  function toggleHospitalityLineItem(index: number) {
    const hospitality = ocrResult?.special.hospitality;
    if (!ocrResult || !hospitality) return;

    const lineItems = hospitality.lineItems.map((item, itemIndex) => (
      itemIndex === index ? { ...item, excluded: !(item.excluded ?? false) } : item
    ));

    setOcrResult({ ...ocrResult, special: { ...ocrResult.special, hospitality: { ...hospitality, lineItems } } });
    const active = sumActiveLineItems(lineItems, (item) => item.amount);
    const all = sumActiveLineItems(
      lineItems.map((item) => ({ ...item, excluded: false })),
      (item) => item.amount,
    );
    applyGrossFromLineItems(active, all.activeSum);
  }

  function toggleLodgingLineItem(index: number) {
    const lodging = ocrResult?.special.lodging;
    if (!ocrResult || !lodging) return;

    const lineItems = lodging.lineItems.map((item, itemIndex) => (
      itemIndex === index ? { ...item, excluded: !(item.excluded ?? false) } : item
    ));

    setOcrResult({ ...ocrResult, special: { ...ocrResult.special, lodging: { ...lodging, lineItems } } });
    const active = sumActiveLineItems(lineItems, (item) => item.amount);
    const all = sumActiveLineItems(
      lineItems.map((item) => ({ ...item, excluded: false })),
      (item) => item.amount,
    );
    applyGrossFromLineItems(active, all.activeSum);
  }

  useOcrPrefill({
    ocrResult,
    manualOverrides,
    partyRoleManuallyChanged,
    suggestedCountry,
    countryManuallyChanged,
    countryId,
    currency,
    isHospitality,
    hospitalityLocationManual,
    hospitalityLocation,
    setters: {
      setDate, setDueDate, setServiceDate, setInvoiceNumber,
      setAmount, setNetAmount, setTaxAmount, setCurrency,
      setSupplier, setPartyRole, setCountryId, setHospitalityLocation,
    },
  });

  useEffect(() => {
    const parsedAmount = parseLocalizedNumber(amount);
    if (reverseCharge) {
      setVatRatePercent(null);
      setTaxAmount("0");
      if (parsedAmount !== null && !manualOverrides.netAmount) {
        setNetAmount(formatAmountInput(parsedAmount));
      }
      return;
    }

    const selectedCountry = countries.find((country) => country.id === countryId);
    const countryRate = selectedCountry?.vatRatePercent ?? null;
    if (countryRate == null || countryRate < 0) {
      setVatRatePercent(null);
      return;
    }
    if (parsedAmount === null) return;

    if (manualOverrides.taxAmount && manualOverrides.netAmount) {
      setVatRatePercent(countryRate);
      return;
    }

    const { net, tax } = splitGrossByVatRate(parsedAmount, countryRate);
    setVatRatePercent(countryRate);
    if (!manualOverrides.netAmount) setNetAmount(formatAmountInput(net));
    if (!manualOverrides.taxAmount) setTaxAmount(formatAmountInput(tax));
  }, [amount, countryId, countries, reverseCharge, manualOverrides.netAmount, manualOverrides.taxAmount]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  async function applySelectedFile(nextFile: File, source: CaptureSource, detection: DocumentDetectionResult | null = null, trigger: CaptureTrigger | null = null) {
    const allowed = ["image/jpeg", "image/png", "application/pdf"];
    if (!allowed.includes(nextFile.type)) {
      setError("Nur JPG, PNG und PDF sind erlaubt.");
      return;
    }
    if (nextFile.size > 20 * 1024 * 1024) {
      setError("Datei ist zu gross (max. 20 MB).");
      return;
    }

    setError(null);
    setLineItemNotice(null);
    setIsPreparingAsset(true);
    setOriginalFile(nextFile);
    setCaptureSource(source);
    setCaptureTrigger(trigger);
    setOcrResult(null);
    setPartyRoleManuallyChanged(false);
    setWorkingImageInfo(null);

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }

    let nextOcrFile = nextFile;
    let nextPreviewUrl: string | null = null;
    let nextWorkingInfo: ReceiptImageProcessingResult | null = null;

    try {
      if (nextFile.type.startsWith("image/")) {
        try {
          nextWorkingInfo = await createReceiptWorkingImage(nextFile, {
            cropBounds: source === "camera" ? detection?.bounds ?? null : null,
            rotationDeg: source === "camera" ? detection?.angleDeg ?? 0 : 0,
          });
          nextOcrFile = nextWorkingInfo.workingFile;
          nextPreviewUrl = nextWorkingInfo.previewUrl;
        } catch {
          nextPreviewUrl = URL.createObjectURL(nextFile);
          setError("Bildvorbereitung war nicht moeglich. Die KI-Auslese nutzt deshalb das Originalbild.");
        }
      }

      setWorkingImageInfo(nextWorkingInfo);
      setPreviewUrl(nextPreviewUrl);
      await runAnalysis(nextOcrFile);
    } finally {
      setIsPreparingAsset(false);
    }
  }

  async function runAnalysis(file: File) {
    setOcrRunning(true);
    setError(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/ai/analyze", { method: "POST", body: formData });
      const responseText = await response.text();
      let data: unknown = null;

      if (responseText) {
        try {
          data = JSON.parse(responseText);
        } catch {
          data = null;
        }
      }

      if (!response.ok) {
        const serverError = data && typeof data === "object" && "error" in data ? String(data.error) : null;
        const fallbackMessage = response.status === 504
          ? "Die KI-Auslese dauerte zu lange. Bitte kleinere Bilder oder einfachere PDFs verwenden und fehlende Angaben manuell ergaenzen."
          : `Die KI-Auslese konnte nicht ausgefuehrt werden (HTTP ${response.status}).`;
        throw new Error(serverError ?? fallbackMessage);
      }

      if (!data || typeof data !== "object" || !("rawText" in data)) {
        throw new Error("Die KI-Auslese lieferte keine gueltige Antwort. Bitte Datei pruefen und fehlende Angaben manuell ergaenzen.");
      }

      setOcrResult(data as OcrResult);
      const extractedPartyRole = (data as OcrResult).extracted?.partyRole;
      if (extractedPartyRole === "CREDITOR" || extractedPartyRole === "DEBTOR") {
        setPartyRoleManuallyChanged(false);
        setPartyRole(extractedPartyRole);
      }
    } catch (requestError: unknown) {
      const message = requestError instanceof Error
        ? requestError.message
        : "Die KI-Auslese konnte nicht ausgefuehrt werden. Bitte fehlende Angaben manuell ergaenzen.";
      setError(message);
    } finally {
      setOcrRunning(false);
    }
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const nextFile = event.target.files?.[0];
    if (!nextFile) return;
    void applySelectedFile(nextFile, "upload");
  }

  function handleSubmit(formData: FormData) {
    setError(null);

    if (!originalFile) {
      setError("Bitte zuerst den Originalbeleg hochladen oder mit der Kamera aufnehmen.");
      return;
    }

    if (duplicateCheck.hasDuplicates) {
      setError("Bitte pruefen Sie den moeglichen Duplikat-Beleg und bestaetigen Sie mit 'Trotzdem speichern'.");
      return;
    }

    const body = buildBody(formData);
    const action = (formData.get("_action") as string) || "save";
    const shouldContinue = action === "save_next";

    startTransition(async () => {
      const formPayload = new FormData();
      formPayload.append("file", originalFile);
      formPayload.append("data", JSON.stringify(body));
      formPayload.append("action", action);

      const response = await fetch("/api/receipts/create-with-file", {
        method: "POST",
        body: formPayload,
      });

      if (!response.ok) {
        const data = await response.json();
        setError(getApiErrorMessage(data, "Fehler beim Speichern."));
        return;
      }

      const { receipt } = await response.json();

      if (shouldContinue) {
        // Leeres Formular fuer den naechsten Beleg: State sofort leeren und
        // ueber den wechselnden Query-Parameter zusaetzlich einen Remount erzwingen.
        resetForm();
        router.push(`/receipts/new?continued=1&t=${Date.now()}`);
        router.refresh();
        return;
      }

      router.push(`/receipts/${receipt.id}`);
      router.refresh();
    });
  }

  function buildBody(formData: FormData): Record<string, unknown> {
    const amountValue = parseFloat((formData.get("amount") as string).replace(",", "."));
    const selectedCurrency = (formData.get("currency") as string) || "EUR";

    let parsedExchangeRate: number | null = null;
    const exchangeRateValue = (formData.get("exchangeRate") as string) || exchangeRate;
    if (exchangeRateValue) parsedExchangeRate = parseFloat(exchangeRateValue.replace(",", "."));

    const parsedNet = netAmount ? parseFloat(netAmount.replace(",", ".")) : null;
    let parsedTax = taxAmount ? parseFloat(taxAmount.replace(",", ".")) : null;
    if (reverseCharge) parsedTax = 0;

    const body: Record<string, unknown> = {
      date: formData.get("date"),
      partyRole: formData.get("partyRole") || partyRole || "CREDITOR",
      supplier: formData.get("supplier") || null,
      invoiceNumber: formData.get("invoiceNumber") || null,
      serviceDate: null,
      dueDate: null,
      amount: isNaN(amountValue) ? 0 : amountValue,
      currency: selectedCurrency,
      netAmount: parsedNet !== null && !isNaN(parsedNet) ? parsedNet : null,
      taxAmount: parsedTax !== null && !isNaN(parsedTax) ? parsedTax : null,
      reverseCharge,
      vatRatePercent: reverseCharge ? null : vatRatePercent,
      exchangeRate: parsedExchangeRate,
      exchangeRateDate: formData.get("exchangeRateDate") || exchangeRateDate || null,
      countryId: formData.get("countryId") || null,
      vehicleId: formData.get("vehicleId") || null,
      purposeId: formData.get("purposeId"),
      datevBelegtyp: formData.get("datevBelegtyp") || datevBelegtyp,
      remark: formData.get("remark") || null,
      aiRawText: ocrResult?.rawText ?? null,
      aiDocumentType: toReceiptDocumentType(ocrResult?.extracted.documentType),
      aiStructuredData: ocrResult ? buildStructuredData(ocrResult, buildFieldReviewStates({ result: ocrResult, manualOverrides, countryManuallyChanged, hospitalityLocationManual, selectedCountryId: String(formData.get("countryId") || ""), suggestedCountryId: suggestedCountry?.id ?? null, submitted: true }), { dueDate }) : null,
    };

    if (isHospitality) {
      body.hospitality = {
        occasion,
        guests,
        location: hospitalityLocation,
      };
    }

    return body;
  }

  const duplicateCheck = useDuplicateCheck();

  useEffect(() => {
    duplicateCheck.check({ date, amount, supplier, invoiceNumber });
  }, [date, amount, supplier, invoiceNumber]); // eslint-disable-line react-hooks/exhaustive-deps

  const hasDetectedValues = ocrResult ? hasDetectedOcrValues(ocrResult) : false;

  const fileSectionFieldReviewStates = useMemo(() => {
    if (!ocrResult) return {};
    return buildFieldReviewStates({
      result: ocrResult,
      manualOverrides,
      countryManuallyChanged,
      hospitalityLocationManual,
      selectedCountryId: countryId,
      suggestedCountryId: suggestedCountry?.id ?? null,
      submitted: false,
    });
  }, [ocrResult, manualOverrides, countryManuallyChanged, hospitalityLocationManual, countryId, suggestedCountry?.id]);

  return (
    <>
      <form action={handleSubmit} className="space-y-6">
        <ReceiptFormFileSection
          originalFile={originalFile}
          previewUrl={previewUrl}
          captureSource={captureSource}
          captureTrigger={captureTrigger}
          workingImageInfo={workingImageInfo}
          cameraSupported={cameraSupported}
          isPreparingAsset={isPreparingAsset}
          ocrRunning={ocrRunning}
          ocrResult={ocrResult}
          hasDetectedValues={hasDetectedValues}
          fieldReviewStates={fileSectionFieldReviewStates}
          suggestedPurpose={suggestedPurpose}
          suggestedCountry={suggestedCountry}
          purposeId={purposeId}
          countryId={countryId}
          onOpenCamera={() => setCameraOpen(true)}
          onFileChange={handleFileChange}
          onApplySuggestedPurpose={setPurposeId}
          onApplySuggestedCountry={changeCountry}
          onToggleInvoiceLineItem={toggleInvoiceLineItem}
          onToggleHospitalityLineItem={toggleHospitalityLineItem}
          onToggleLodgingLineItem={toggleLodgingLineItem}
          lineItemNotice={lineItemNotice}
        />

        <ReceiptFormDataSection
          today={today}
          date={date}
          partyRole={partyRole}
          amount={amount}
          invoiceNumber={invoiceNumber}
          netAmount={netAmount}
          taxAmount={taxAmount}
          reverseCharge={reverseCharge}
          currency={currency}
          supplier={supplier}
          exchangeRate={exchangeRate}
          exchangeRateDate={exchangeRateDate}
          exchangeRateLoading={exchangeRateLoading}
          exchangeRateInfo={exchangeRateInfo}
          requiresExchangeRate={requiresExchangeRate}
          normalizedCurrency={normalizedCurrency}
          amountEurPreview={amountEurPreview}
          currencyOptions={currencyOptions}
          markManualOverride={markManualOverride}
          setDate={setDate}
          setPartyRole={(value) => {
            setPartyRoleManuallyChanged(true);
            setPartyRole(value);
          }}
          setAmount={setAmount}
          setInvoiceNumber={setInvoiceNumber}
          setNetAmount={setNetAmount}
          setTaxAmount={setTaxAmount}
          setReverseCharge={(value) => {
            if (value) {
              setManualOverrides((current) => ({ ...current, taxAmount: false, netAmount: false }));
            } else {
              setManualOverrides((current) => ({ ...current, taxAmount: false }));
            }
            setReverseCharge(value);
          }}
          setCurrency={setCurrency}
          setSupplier={setSupplier}
          setExchangeRate={setExchangeRate}
          setExchangeRateDate={setExchangeRateDate}
        />

        <ReceiptFormAssignmentSection
          purposes={purposes}
          countries={countries}
          vehicles={vehicles}
          purposeId={purposeId}
          countryId={countryId}
          vehicleId={vehicleId}
          datevBelegtyp={datevBelegtyp}
          prefillSource={prefillSource}
          setPurposeId={setPurposeId}
          setCountryId={changeCountry}
          setCountryManuallyChanged={setCountryManuallyChanged}
          setVehicleId={setVehicleId}
          setDatevBelegtyp={(value) => {
            setDatevBelegtypManuallyChanged(true);
            setDatevBelegtyp(value);
          }}
        />

        {isHospitality ? (
          <ReceiptFormHospitalitySection
            ocrResult={ocrResult}
            occasion={occasion}
            guests={guests}
            hospitalityLocation={hospitalityLocation}
            setOccasion={setOccasion}
            setGuests={setGuests}
            setHospitalityLocationManual={setHospitalityLocationManual}
            setHospitalityLocation={setHospitalityLocation}
          />
        ) : null}

        {duplicateCheck.hasDuplicates ? (
          <DuplicateWarning
            candidates={duplicateCheck.candidates}
            onDismiss={duplicateCheck.dismiss}
          />
        ) : null}

        {error ? (
          <p className="text-sm font-medium text-danger">{error}</p>
        ) : null}

        <ReceiptFormActions isPending={isPending} isPreparingAsset={isPreparingAsset} />
      </form>

      <CameraCapture
        open={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onCapture={({ file, detection, trigger }) => {
          void applySelectedFile(file, "camera", detection, trigger);
        }}
      />
    </>
  );
}
