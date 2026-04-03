"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { OcrResult } from "@/lib/ocr";
import { CameraCapture } from "@/components/receipts/camera-capture";
import { SmartCaptureSuggestions } from "@/components/receipts/smart-capture-suggestions";
import { createReceiptWorkingImage, type ReceiptImageProcessingResult } from "@/lib/receipt-image-processing";
import type { DocumentDetectionResult } from "@/components/receipts/document-detector";
import { confidenceToReviewStatus, documentTypeLabels, type OcrFieldReviewStatus, toReceiptDocumentType } from "@/lib/ocr-suggestions";

type Purpose = { id: string; name: string; isHospitality: boolean };
type Category = { id: string; name: string };
type Country = { id: string; name: string; code: string | null; currencyCode: string | null };
type Vehicle = { id: string; plate: string; description: string | null };

type Props = {
  purposes: Purpose[];
  categories: Category[];
  countries: Country[];
  vehicles: Vehicle[];
  userDefaults: {
    defaultCountryId: string | null;
    defaultVehicleId: string | null;
    defaultPurposeId: string | null;
    defaultCategoryId: string | null;
  };
};

type OcrExtracted = OcrResult["extracted"];
type OcrFieldKey = keyof Pick<OcrExtracted, "date" | "dueDate" | "amount" | "currency" | "supplier">;
type CaptureSource = "upload" | "camera";
type CaptureTrigger = "manual" | "auto";

type ReceiptSelectionState = {
  purposeId: string;
  categoryId: string;
  countryId: string;
  vehicleId: string;
};

type PrefillSource = "session" | "defaults" | "none";

const LAST_SELECTIONS_STORAGE_KEY = "belegbox.receipts.last-selection.v1";

export function ReceiptForm({ purposes, categories, countries, vehicles, userDefaults }: Props) {
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

  const today = new Date().toISOString().split("T")[0];
  const [date, setDate] = useState(today);
  const [dueDate, setDueDate] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("EUR");
  const [supplier, setSupplier] = useState("");
  const [purposeId, setPurposeId] = useState(userDefaults.defaultPurposeId ?? "");
  const [categoryId, setCategoryId] = useState(userDefaults.defaultCategoryId ?? "");
  const [countryId, setCountryId] = useState(userDefaults.defaultCountryId ?? "");
  const [vehicleId, setVehicleId] = useState(userDefaults.defaultVehicleId ?? "");
  const [countryManuallyChanged, setCountryManuallyChanged] = useState(false);
  const [occasion, setOccasion] = useState("");
  const [guests, setGuests] = useState("");
  const [hospitalityLocation, setHospitalityLocation] = useState("");
  const [prefillSource, setPrefillSource] = useState<PrefillSource>("none");
  const [error, setError] = useState<string | null>(null);
  const [manualOverrides, setManualOverrides] = useState<Record<OcrFieldKey, boolean>>({
    date: false,
    dueDate: false,
    amount: false,
    currency: false,
    supplier: false,
  });
  const [hospitalityLocationManual, setHospitalityLocationManual] = useState(false);

  const validIds = useMemo(() => ({
    purposes: new Set(purposes.map((purpose) => purpose.id)),
    categories: new Set(categories.map((category) => category.id)),
    countries: new Set(countries.map((country) => country.id)),
    vehicles: new Set(vehicles.map((vehicle) => vehicle.id)),
  }), [categories, countries, purposes, vehicles]);

  const selectedPurpose = purposes.find((purpose) => purpose.id === purposeId);
  const isHospitality = selectedPurpose?.isHospitality ?? false;
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

  function markManualOverride(field: OcrFieldKey) {
    setManualOverrides((current) => (current[field] ? current : { ...current, [field]: true }));
  }

  useEffect(() => {
    if (!ocrResult) return;
    const extracted = ocrResult.extracted;

    if (extracted.date && !manualOverrides.date) setDate(extracted.date);
    if (!manualOverrides.dueDate) setDueDate(extracted.dueDate ?? "");
    if (extracted.amount !== null && !manualOverrides.amount) setAmount(String(extracted.amount).replace(".", ","));
    if (extracted.currency && !manualOverrides.currency) setCurrency(extracted.currency);
    if (extracted.supplier && !manualOverrides.supplier) setSupplier(extracted.supplier);
  }, [manualOverrides, ocrResult]);

  useEffect(() => {
    if (!suggestedCountry || countryManuallyChanged || countryId) return;
    if (suggestedCountry.confidence === "high") {
      setCountryId(suggestedCountry.id);
    }
  }, [countryId, countryManuallyChanged, suggestedCountry]);

  useEffect(() => {
    if (!suggestedCountry || !suggestedCountry.currencyCode) return;
    if (ocrResult?.extracted.currency || manualOverrides.currency) return;
    if (suggestedCountry.currencyCode !== "EUR" && currency === "EUR") {
      setCurrency(suggestedCountry.currencyCode);
    }
  }, [currency, manualOverrides.currency, ocrResult?.extracted.currency, suggestedCountry]);

  useEffect(() => {
    if (!ocrResult || !isHospitality || hospitalityLocationManual) return;
    const suggestedLocation = ocrResult.special.hospitality?.location ?? ocrResult.extracted.location;
    if (suggestedLocation && !hospitalityLocation) {
      setHospitalityLocation(suggestedLocation);
    }
  }, [hospitalityLocation, hospitalityLocationManual, isHospitality, ocrResult]);

  useEffect(() => {
    const sessionSelections = readLastSelections();
    const resolved = resolveSelectionState({
      sessionSelections,
      userDefaults,
      validIds,
    });

    setPurposeId(resolved.selection.purposeId);
    setCategoryId(resolved.selection.categoryId);
    setCountryId(resolved.selection.countryId);
    setVehicleId(resolved.selection.vehicleId);
    setPrefillSource(resolved.source);
  }, [userDefaults, validIds]);

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
    setIsPreparingAsset(true);
    setOriginalFile(nextFile);
    setCaptureSource(source);
    setCaptureTrigger(trigger);
    setOcrResult(null);
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
          setError("Bildvorbereitung war nicht moeglich. OCR nutzt deshalb das Originalbild.");
        }
      }

      setWorkingImageInfo(nextWorkingInfo);
      setPreviewUrl(nextPreviewUrl);
      await runOcr(nextOcrFile);
    } finally {
      setIsPreparingAsset(false);
    }
  }

  async function runOcr(file: File) {
    setOcrRunning(true);
    setError(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/ocr/analyze", { method: "POST", body: formData });
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
          ? "Die OCR-Analyse dauerte zu lange. Bitte kleinere Bilder oder einfachere PDFs verwenden; manuelle Erfassung bleibt moeglich."
          : `OCR konnte nicht ausgefuehrt werden (HTTP ${response.status}).`;
        throw new Error(serverError ?? fallbackMessage);
      }

      if (!data || typeof data !== "object" || !("rawText" in data)) {
        throw new Error("OCR lieferte keine gueltige Antwort. Bitte Datei oder Serverprotokoll pruefen.");
      }

      setOcrResult(data as OcrResult);
    } catch (requestError: unknown) {
      const message = requestError instanceof Error
        ? requestError.message
        : "OCR konnte nicht ausgefuehrt werden.";
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

    const body = buildBody(formData);
    const action = formData.get("_action");
    const shouldSend = action === "send";
    const shouldContinue = action === "save_next";

    startTransition(async () => {
      const receiptResponse = await fetch("/api/receipts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!receiptResponse.ok) {
        const data = await receiptResponse.json();
        setError(data.error ?? "Fehler beim Speichern.");
        return;
      }

      const receipt = await receiptResponse.json();

      const uploadData = new FormData();
      uploadData.append("file", originalFile);
      uploadData.append("receiptId", receipt.id);
      const uploadResponse = await fetch("/api/files/upload", { method: "POST", body: uploadData });
      if (!uploadResponse.ok) {
        const data = await uploadResponse.json();
        setError(`Beleg gespeichert, aber Datei-Upload fehlgeschlagen: ${data.error}`);
        router.push(`/receipts/${receipt.id}`);
        router.refresh();
        return;
      }

      persistLastSelections({ purposeId, categoryId, countryId, vehicleId });

      if (shouldSend) {
        const sendResponse = await fetch(`/api/receipts/${receipt.id}/send`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        if (!sendResponse.ok) {
          // Receipt saved, file uploaded, but send failed; detail page shows FAILED status.
        }
      }

      if (shouldContinue) {
        router.push("/receipts/new?continued=1");
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

    let exchangeRate: number | null = null;
    const exchangeRateValue = formData.get("exchangeRate") as string;
    if (exchangeRateValue) exchangeRate = parseFloat(exchangeRateValue.replace(",", "."));

    const body: Record<string, unknown> = {
      date: formData.get("date"),
      supplier: formData.get("supplier") || null,
      amount: isNaN(amountValue) ? 0 : amountValue,
      currency: selectedCurrency,
      exchangeRate,
      exchangeRateDate: formData.get("exchangeRateDate") || null,
      countryId: formData.get("countryId") || null,
      vehicleId: formData.get("vehicleId") || null,
      purposeId: formData.get("purposeId"),
      categoryId: formData.get("categoryId"),
      remark: formData.get("remark") || null,
      ocrRawText: ocrResult?.rawText ?? null,
      detectedDocumentType: toReceiptDocumentType(ocrResult?.extracted.documentType),
      ocrStructuredData: ocrResult ? buildStructuredData(ocrResult, buildFieldReviewStates({ result: ocrResult, manualOverrides, countryManuallyChanged, hospitalityLocationManual, selectedCountryId: String(formData.get("countryId") || ""), suggestedCountryId: suggestedCountry?.id ?? null, submitted: true }), { dueDate }) : null,
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

  const hasDetectedValues = ocrResult ? hasDetectedOcrValues(ocrResult) : false;

  return (
    <>
      <form action={handleSubmit} className="space-y-6">
        <Card>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">Belegdatei</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                JPG, PNG oder PDF hochladen (max. 20 MB). Die Originaldatei ist fuer neue Belege Pflicht. OCR wird automatisch ausgefuehrt.
              </p>
            </div>
            {captureSource ? (
              <span className="rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
                Quelle: {captureSource === "camera" ? `Kamera${captureTrigger === "auto" ? " (Auto-Capture)" : captureTrigger === "manual" ? " (manuell)" : ""}` : "Datei-Upload"}
              </span>
            ) : null}
          </div>
          <div className="mt-4 space-y-4">
            <div className="flex flex-wrap gap-3">
              {cameraSupported ? (
                <button
                  type="button"
                  onClick={() => setCameraOpen(true)}
                  className="rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
                >
                  Kamera in App oeffnen
                </button>
              ) : (
                <p className="text-sm text-muted-foreground">
                  In-App-Kamera braucht HTTPS oder localhost. Der normale Upload funktioniert weiterhin.
                </p>
              )}
              <label className="inline-flex cursor-pointer items-center rounded-2xl border border-border bg-card px-5 py-3 text-sm font-semibold transition hover:border-primary/40 hover:text-primary">
                Datei auswaehlen
                <input
                  type="file"
                  accept="image/jpeg,image/png,application/pdf"
                  onChange={handleFileChange}
                  className="sr-only"
                />
              </label>
            </div>

            <label className={`flex cursor-pointer flex-col items-center gap-3 rounded-2xl border-2 border-dashed p-8 transition hover:border-primary/40 hover:bg-primary/5 ${originalFile ? "border-border" : "border-accent/40"}`}>
              <span className="text-sm font-medium text-muted-foreground">
                {originalFile ? originalFile.name : "Kamera oder Datei waehlen"}
              </span>
              <span className="text-xs text-muted-foreground">
                Originalbild bleibt unveraendert gespeichert. Bei Fotos nutzt OCR eine getrennte Arbeitskopie fuer Vorschau, Crop und Lesbarkeit.
              </span>
            </label>

            {previewUrl ? (
              <img src={previewUrl} alt="Vorschau" className="max-h-72 w-full rounded-xl object-contain" />
            ) : null}
            {isPreparingAsset ? (
              <p className="text-sm text-muted-foreground">Bild wird fuer Vorschau und OCR vorbereitet...</p>
            ) : null}
            {workingImageInfo ? (
              <div className="rounded-xl border border-border/80 bg-muted/40 p-3 text-xs text-muted-foreground">
                Arbeitskopie fuer OCR: {workingImageInfo.appliedSteps.join(", ")}
              </div>
            ) : null}
            {ocrRunning ? (
              <p className="text-sm text-muted-foreground">OCR laeuft...</p>
            ) : null}
            {ocrResult ? (
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
                <p className="text-xs font-semibold text-primary">
                  {getOcrHeadline(ocrResult.sourceType)}
                </p>
                {ocrResult.message ? (
                  <p className="mt-1 text-xs text-muted-foreground">{ocrResult.message}</p>
                ) : null}
                {hasDetectedValues ? (
                  <div className="mt-3">
                    <SmartCaptureSuggestions
                      ocrResult={ocrResult}
                      purposeSuggestion={suggestedPurpose}
                      countrySuggestion={suggestedCountry}
                      currentPurposeId={purposeId}
                      currentCountryId={countryId}
                      fieldReviewStates={buildFieldReviewStates({
                        result: ocrResult,
                        manualOverrides,
                        countryManuallyChanged,
                        hospitalityLocationManual,
                        selectedCountryId: countryId,
                        suggestedCountryId: suggestedCountry?.id ?? null,
                        submitted: false,
                      })}
                      onApplySuggestedPurpose={setPurposeId}
                      onApplySuggestedCountry={(value) => { setCountryId(value); setCountryManuallyChanged(true); }}
                    />
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-muted-foreground">Keine sicheren Werte erkannt. Du kannst den Beleg trotzdem normal manuell erfassen.</p>
                )}
              </div>
            ) : null}
          </div>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold tracking-tight">Belegdaten</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Input
              label="Belegdatum"
              name="date"
              type="date"
              required
              value={date}
              onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                markManualOverride("date");
                setDate(event.target.value);
              }}
              max={today}
            />
            <Input
              label="Faelligkeitsdatum"
              name="dueDate"
              type="date"
              value={dueDate}
              onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                markManualOverride("dueDate");
                setDueDate(event.target.value);
              }}
            />
            <Input
              label="Betrag"
              name="amount"
              type="text"
              inputMode="decimal"
              required
              placeholder="0,00"
              value={amount}
              onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                markManualOverride("amount");
                setAmount(event.target.value);
              }}
            />
            <Input
              label="Waehrung"
              name="currency"
              type="text"
              maxLength={3}
              placeholder="EUR"
              value={currency}
              onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                markManualOverride("currency");
                setCurrency(event.target.value);
              }}
            />
            <Input
              label="Lieferant / Haendler"
              name="supplier"
              placeholder="optional"
              value={supplier}
              onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                markManualOverride("supplier");
                setSupplier(event.target.value);
              }}
            />
            <Input
              label="Wechselkurs (optional)"
              name="exchangeRate"
              type="text"
              inputMode="decimal"
              placeholder="1 EUR = ?"
            />
            <Input
              label="Kursdatum (optional)"
              name="exchangeRateDate"
              type="date"
            />
          </div>
        </Card>

        <Card>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">Zuordnung</h2>
              <p className="mt-1 text-sm text-muted-foreground">Diese Felder werden zuerst aus der letzten Folgeerfassung, dann aus deinen Standardwerten vorbelegt.</p>
            </div>
            {prefillSource !== "none" ? (
              <span className="rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
                {prefillSource === "session" ? "Vorbelegt aus letzter Erfassung" : "Vorbelegt aus deinen Standardwerten"}
              </span>
            ) : null}
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <SelectField label="Zweck" name="purposeId" required value={purposeId} onChange={setPurposeId}>
              <option value="">-- Zweck waehlen --</option>
              {purposes.map((purpose) => (
                <option key={purpose.id} value={purpose.id}>{purpose.name}</option>
              ))}
            </SelectField>
            <SelectField label="Kategorie" name="categoryId" required value={categoryId} onChange={setCategoryId}>
              <option value="">-- Kategorie waehlen --</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </SelectField>
            <SelectField label="Land" name="countryId" value={countryId} onChange={(value) => { setCountryManuallyChanged(true); setCountryId(value); }}>
              <option value="">-- optional --</option>
              {countries.map((country) => (
                <option key={country.id} value={country.id}>{country.name}{country.code ? ` (${country.code})` : ""}</option>
              ))}
            </SelectField>
            <SelectField label="Kfz" name="vehicleId" value={vehicleId} onChange={setVehicleId}>
              <option value="">-- optional --</option>
              {vehicles.map((vehicle) => (
                <option key={vehicle.id} value={vehicle.id}>{vehicle.plate}{vehicle.description ? ` - ${vehicle.description}` : ""}</option>
              ))}
            </SelectField>
            <label className="grid gap-1 text-sm font-medium sm:col-span-2 lg:col-span-2">
              <span className="text-xs text-muted-foreground">Bemerkung</span>
              <textarea
                name="remark"
                rows={2}
                maxLength={2000}
                placeholder="Freitext (optional)"
                className="rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
              />
            </label>
          </div>
        </Card>

        {isHospitality ? (
          <Card>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold tracking-tight">Bewirtungsangaben</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Diese Felder sind bei Bewirtungsbelegen Pflicht.
                </p>
              </div>
              {ocrResult?.extracted.documentType === "hospitality" ? (
                <span className="rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
                  OCR vermutet Bewirtungsbeleg
                </span>
              ) : null}
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Input label="Anlass" name="occasion" required placeholder="z.B. Projektbesprechung" value={occasion} onChange={(event: React.ChangeEvent<HTMLInputElement>) => setOccasion(event.target.value)} />
              <label className="grid gap-1 text-sm font-medium">
                <span className="text-xs text-muted-foreground">Gaeste / Teilnehmer</span>
                <textarea
                  name="guests"
                  required
                  rows={2}
                  placeholder="Hr. Mueller, Fr. Schmidt"
                  value={guests}
                  onChange={(event) => setGuests(event.target.value)}
                  className="rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
                />
              </label>
              <Input label="Ort" name="location" required placeholder="z.B. Restaurant Adria, Berlin" value={hospitalityLocation} onChange={(event: React.ChangeEvent<HTMLInputElement>) => { setHospitalityLocationManual(true); setHospitalityLocation(event.target.value); }} />
            </div>
          </Card>
        ) : null}

        {error ? (
          <p className="text-sm font-medium text-danger">{error}</p>
        ) : null}
        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            name="_action"
            value="save"
            disabled={isPending || isPreparingAsset}
            className="rounded-2xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending ? "Wird gespeichert..." : "Speichern"}
          </button>
          <button
            type="submit"
            name="_action"
            value="save_next"
            disabled={isPending || isPreparingAsset}
            className="rounded-2xl border border-border bg-card px-6 py-3 text-sm font-semibold transition hover:border-primary/40 hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending ? "Wird vorbereitet..." : "Speichern & naechsten Beleg erfassen"}
          </button>
          <button
            type="submit"
            name="_action"
            value="send"
            disabled={isPending || isPreparingAsset}
            className="rounded-2xl border border-primary bg-primary/10 px-6 py-3 text-sm font-semibold text-primary transition hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending ? "Wird gesendet..." : "Speichern & Senden"}
          </button>
        </div>
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

type FieldReviewStateMap = Partial<Record<
  "date" | "invoiceDate" | "dueDate" | "serviceDate" | "amount" | "grossAmount" | "netAmount" | "taxAmount" | "currency" | "supplier" | "invoiceNumber" | "country" | "documentType" | "paymentMethod" | "cardLastDigits" | "invoiceLineItems" | "fuelLiters" | "fuelPricePerLiter" | "fuelType" | "hospitalityLocation" | "hospitalitySubtotal" | "hospitalityTip" | "lodgingLocation" | "lodgingNights" | "lodgingSubtotal" | "lodgingTax" | "lodgingFees" | "parkingLocation" | "parkingDuration" | "parkingEntryTime" | "parkingExitTime" | "tollStation" | "tollRouteHint" | "tollVehicleClass",
  OcrFieldReviewStatus
>>;

function hasDetectedOcrValues(result: OcrResult) {
  const fuel = result.special.fuel;
  const hospitality = result.special.hospitality;
  const lodging = result.special.lodging;
  const parking = result.special.parking;
  const toll = result.special.toll;

  return Boolean(
    result.extracted.date
      || result.extracted.invoiceDate
      || result.extracted.dueDate
      || result.extracted.serviceDate
      || result.extracted.time
      || result.extracted.amount !== null
      || result.extracted.grossAmount !== null
      || result.extracted.netAmount !== null
      || result.extracted.taxAmount !== null
      || result.extracted.currency
      || result.extracted.supplier
      || result.extracted.invoiceNumber
      || result.extracted.location
      || result.extracted.countryCode
      || result.extracted.countryName
      || result.extracted.paymentMethod
      || result.extracted.cardLastDigits
      || (result.special.invoice && result.special.invoice.lineItems.length > 0)
      || (fuel && (fuel.liters !== null || fuel.pricePerLiter !== null || fuel.fuelType))
      || (hospitality && (hospitality.location || hospitality.subtotal !== null || hospitality.tip !== null || hospitality.lineItems.length > 0))
      || (lodging && (lodging.location || lodging.nights !== null || lodging.subtotal !== null || lodging.tax !== null || lodging.fees !== null || lodging.lineItems.length > 0))
      || (parking && (parking.location || parking.durationText || parking.entryTime || parking.exitTime))
      || (toll && (toll.station || toll.routeHint || toll.vehicleClass)),
  );
}

function buildStructuredData(result: OcrResult, fieldReviewStates: FieldReviewStateMap, overrides?: { dueDate?: string }) {
  return {
    sourceType: result.sourceType,
    extracted: {
      ...result.extracted,
      dueDate: overrides?.dueDate || null,
    },
    fieldConfidence: result.fieldConfidence,
    fieldReviewStates,
    special: result.special,
    specialConfidence: result.specialConfidence,
  };
}

function buildFieldReviewStates({
  result,
  manualOverrides,
  countryManuallyChanged,
  hospitalityLocationManual,
  selectedCountryId,
  suggestedCountryId,
  submitted,
}: {
  result: OcrResult;
  manualOverrides: Record<OcrFieldKey, boolean>;
  countryManuallyChanged: boolean;
  hospitalityLocationManual: boolean;
  selectedCountryId: string;
  suggestedCountryId: string | null;
  submitted: boolean;
}): FieldReviewStateMap {
  const states: FieldReviewStateMap = {
    date: manualOverrides.date ? "user_overridden" : submitted && result.extracted.date ? "user_confirmed" : confidenceToReviewStatus(result.fieldConfidence.date),
    invoiceDate: submitted && result.extracted.invoiceDate ? "user_confirmed" : confidenceToReviewStatus(result.fieldConfidence.invoiceDate),
    dueDate: manualOverrides.dueDate ? "user_overridden" : submitted && result.extracted.dueDate ? "user_confirmed" : confidenceToReviewStatus(result.fieldConfidence.dueDate),
    serviceDate: submitted && result.extracted.serviceDate ? "user_confirmed" : confidenceToReviewStatus(result.fieldConfidence.serviceDate),
    amount: manualOverrides.amount ? "user_overridden" : submitted && result.extracted.amount !== null ? "user_confirmed" : confidenceToReviewStatus(result.fieldConfidence.amount),
    grossAmount: submitted && result.extracted.grossAmount !== null ? "user_confirmed" : confidenceToReviewStatus(result.fieldConfidence.grossAmount),
    netAmount: submitted && result.extracted.netAmount !== null ? "user_confirmed" : confidenceToReviewStatus(result.fieldConfidence.netAmount),
    taxAmount: submitted && result.extracted.taxAmount !== null ? "user_confirmed" : confidenceToReviewStatus(result.fieldConfidence.taxAmount),
    currency: manualOverrides.currency ? "user_overridden" : submitted && result.extracted.currency ? "user_confirmed" : confidenceToReviewStatus(result.fieldConfidence.currency),
    supplier: manualOverrides.supplier ? "user_overridden" : submitted && result.extracted.supplier ? "user_confirmed" : confidenceToReviewStatus(result.fieldConfidence.supplier),
    invoiceNumber: submitted && result.extracted.invoiceNumber ? "user_confirmed" : confidenceToReviewStatus(result.fieldConfidence.invoiceNumber),
    documentType: submitted && result.extracted.documentType ? "user_confirmed" : confidenceToReviewStatus(result.fieldConfidence.documentType),
    paymentMethod: submitted && result.extracted.paymentMethod ? "user_confirmed" : confidenceToReviewStatus(result.fieldConfidence.paymentMethod),
    cardLastDigits: submitted && result.extracted.cardLastDigits ? "user_confirmed" : confidenceToReviewStatus(result.fieldConfidence.cardLastDigits),
    invoiceLineItems: result.special.invoice ? confidenceToReviewStatus(result.specialConfidence.invoice?.lineItems) : "not_detected",
    country: result.extracted.countryCode
      ? countryManuallyChanged && selectedCountryId !== suggestedCountryId
        ? "user_overridden"
        : submitted && selectedCountryId && selectedCountryId === suggestedCountryId
          ? "user_confirmed"
          : confidenceToReviewStatus(result.fieldConfidence.country)
      : "not_detected",
    fuelLiters: result.special.fuel ? confidenceToReviewStatus(result.specialConfidence.fuel?.liters) : "not_detected",
    fuelPricePerLiter: result.special.fuel ? confidenceToReviewStatus(result.specialConfidence.fuel?.pricePerLiter) : "not_detected",
    fuelType: result.special.fuel ? confidenceToReviewStatus(result.specialConfidence.fuel?.fuelType) : "not_detected",
    hospitalityLocation: result.special.hospitality
      ? hospitalityLocationManual
        ? "user_overridden"
        : submitted && result.special.hospitality.location
          ? "user_confirmed"
          : confidenceToReviewStatus(result.specialConfidence.hospitality?.location)
      : "not_detected",
    hospitalitySubtotal: result.special.hospitality ? confidenceToReviewStatus(result.specialConfidence.hospitality?.subtotal) : "not_detected",
    hospitalityTip: result.special.hospitality ? confidenceToReviewStatus(result.specialConfidence.hospitality?.tip) : "not_detected",
    lodgingLocation: result.special.lodging ? confidenceToReviewStatus(result.specialConfidence.lodging?.location) : "not_detected",
    lodgingNights: result.special.lodging ? confidenceToReviewStatus(result.specialConfidence.lodging?.nights) : "not_detected",
    lodgingSubtotal: result.special.lodging ? confidenceToReviewStatus(result.specialConfidence.lodging?.subtotal) : "not_detected",
    lodgingTax: result.special.lodging ? confidenceToReviewStatus(result.specialConfidence.lodging?.tax) : "not_detected",
    lodgingFees: result.special.lodging ? confidenceToReviewStatus(result.specialConfidence.lodging?.fees) : "not_detected",
    parkingLocation: result.special.parking ? confidenceToReviewStatus(result.specialConfidence.parking?.location) : "not_detected",
    parkingDuration: result.special.parking ? confidenceToReviewStatus(result.specialConfidence.parking?.durationText) : "not_detected",
    parkingEntryTime: result.special.parking ? confidenceToReviewStatus(result.specialConfidence.parking?.entryTime) : "not_detected",
    parkingExitTime: result.special.parking ? confidenceToReviewStatus(result.specialConfidence.parking?.exitTime) : "not_detected",
    tollStation: result.special.toll ? confidenceToReviewStatus(result.specialConfidence.toll?.station) : "not_detected",
    tollRouteHint: result.special.toll ? confidenceToReviewStatus(result.specialConfidence.toll?.routeHint) : "not_detected",
    tollVehicleClass: result.special.toll ? confidenceToReviewStatus(result.specialConfidence.toll?.vehicleClass) : "not_detected",
  };

  return states;
}

function readLastSelections(): Partial<ReceiptSelectionState> | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(LAST_SELECTIONS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ReceiptSelectionState>;
    return parsed;
  } catch {
    return null;
  }
}

function persistLastSelections(selection: ReceiptSelectionState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LAST_SELECTIONS_STORAGE_KEY, JSON.stringify(selection));
}

function resolveSelectionState({
  sessionSelections,
  userDefaults,
  validIds,
}: {
  sessionSelections: Partial<ReceiptSelectionState> | null;
  userDefaults: Props["userDefaults"];
  validIds: {
    purposes: Set<string>;
    categories: Set<string>;
    countries: Set<string>;
    vehicles: Set<string>;
  };
}): { selection: ReceiptSelectionState; source: PrefillSource } {
  const selection: ReceiptSelectionState = {
    purposeId: "",
    categoryId: "",
    countryId: "",
    vehicleId: "",
  };

  const pickValue = (sessionValue: string | null | undefined, defaultValue: string | null | undefined, ids: Set<string>) => {
    if (sessionValue && ids.has(sessionValue)) return { value: sessionValue, source: "session" as const };
    if (defaultValue && ids.has(defaultValue)) return { value: defaultValue, source: "defaults" as const };
    return { value: "", source: "none" as const };
  };

  const purpose = pickValue(sessionSelections?.purposeId, userDefaults.defaultPurposeId, validIds.purposes);
  const category = pickValue(sessionSelections?.categoryId, userDefaults.defaultCategoryId, validIds.categories);
  const country = pickValue(sessionSelections?.countryId, userDefaults.defaultCountryId, validIds.countries);
  const vehicle = pickValue(sessionSelections?.vehicleId, userDefaults.defaultVehicleId, validIds.vehicles);

  selection.purposeId = purpose.value;
  selection.categoryId = category.value;
  selection.countryId = country.value;
  selection.vehicleId = vehicle.value;

  const sources = [purpose.source, category.source, country.source, vehicle.source];
  if (sources.includes("session")) return { selection, source: "session" };
  if (sources.includes("defaults")) return { selection, source: "defaults" };
  return { selection, source: "none" };
}

function getOcrHeadline(sourceType: OcrResult["sourceType"]): string {
  switch (sourceType) {
    case "pdf-text":
      return "PDF-Text erkannt und als strukturierte Vorschlaege vorbelegt; manuelle Eingaben bleiben erhalten";
    case "pdf-scan":
      return "Scan-PDF per OCR analysiert; strukturierte Vorschlaege sind sichtbar und bleiben pruefbar";
    case "pdf-empty":
      return "Fuer dieses PDF konnten keine verlaesslichen OCR-Vorschlaege erzeugt werden";
    default:
      return "OCR-Ergebnisse als strukturierte Vorschlaege vorbelegt; manuelle Eingaben bleiben erhalten";
  }
}

function SelectField({
  label, name, required, value, onChange, children,
}: {
  label: string;
  name: string;
  required?: boolean;
  value?: string;
  onChange?: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-1 text-sm font-medium">
      <span className="text-xs text-muted-foreground">{label}</span>
      <select
        name={name}
        required={required}
        value={value}
        onChange={onChange ? (event) => onChange(event.target.value) : undefined}
        className="h-12 rounded-2xl border border-border bg-background px-4 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
      >
        {children}
      </select>
    </label>
  );
}
