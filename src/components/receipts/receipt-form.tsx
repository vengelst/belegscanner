"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { OcrResult } from "@/lib/ocr";

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
type OcrFieldKey = keyof OcrExtracted;

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

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [ocrRunning, setOcrRunning] = useState(false);
  const [ocrResult, setOcrResult] = useState<OcrResult | null>(null);

  const today = new Date().toISOString().split("T")[0];
  const [date, setDate] = useState(today);
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("EUR");
  const [supplier, setSupplier] = useState("");
  const [purposeId, setPurposeId] = useState(userDefaults.defaultPurposeId ?? "");
  const [categoryId, setCategoryId] = useState(userDefaults.defaultCategoryId ?? "");
  const [countryId, setCountryId] = useState(userDefaults.defaultCountryId ?? "");
  const [vehicleId, setVehicleId] = useState(userDefaults.defaultVehicleId ?? "");
  const [prefillSource, setPrefillSource] = useState<PrefillSource>("none");
  const [error, setError] = useState<string | null>(null);
  const [manualOverrides, setManualOverrides] = useState<Record<OcrFieldKey, boolean>>({
    date: false,
    amount: false,
    currency: false,
    supplier: false,
  });

  const validIds = useMemo(() => ({
    purposes: new Set(purposes.map((purpose) => purpose.id)),
    categories: new Set(categories.map((category) => category.id)),
    countries: new Set(countries.map((country) => country.id)),
    vehicles: new Set(vehicles.map((vehicle) => vehicle.id)),
  }), [categories, countries, purposes, vehicles]);

  const selectedPurpose = purposes.find((purpose) => purpose.id === purposeId);
  const isHospitality = selectedPurpose?.isHospitality ?? false;

  function markManualOverride(field: OcrFieldKey) {
    setManualOverrides((current) => (current[field] ? current : { ...current, [field]: true }));
  }

  useEffect(() => {
    if (!ocrResult) return;
    const extracted = ocrResult.extracted;

    if (extracted.date && !manualOverrides.date) setDate(extracted.date);
    if (extracted.amount !== null && !manualOverrides.amount) setAmount(String(extracted.amount).replace(".", ","));
    if (extracted.currency && !manualOverrides.currency) setCurrency(extracted.currency);
    if (extracted.supplier && !manualOverrides.supplier) setSupplier(extracted.supplier);
  }, [manualOverrides, ocrResult]);

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

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const nextFile = event.target.files?.[0];
    if (!nextFile) return;

    const allowed = ["image/jpeg", "image/png", "application/pdf"];
    if (!allowed.includes(nextFile.type)) {
      setError("Nur JPG, PNG und PDF sind erlaubt.");
      return;
    }
    if (nextFile.size > 20 * 1024 * 1024) {
      setError("Datei ist zu gross (max. 20 MB).");
      return;
    }

    setFile(nextFile);
    setError(null);

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    if (nextFile.type.startsWith("image/")) {
      setPreviewUrl(URL.createObjectURL(nextFile));
    } else {
      setPreviewUrl(null);
    }

    setOcrRunning(true);
    setOcrResult(null);

    const formData = new FormData();
    formData.append("file", nextFile);

    fetch("/api/ocr/analyze", { method: "POST", body: formData })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error ?? "OCR konnte nicht ausgefuehrt werden.");
        }
        if (data.rawText !== undefined) {
          setOcrResult(data as OcrResult);
        }
      })
      .catch((requestError: unknown) => {
        const message = requestError instanceof Error ? requestError.message : "OCR konnte nicht ausgefuehrt werden.";
        setError(message);
      })
      .finally(() => setOcrRunning(false));
  }

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

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
    };

    if (isHospitality) {
      body.hospitality = {
        occasion: formData.get("occasion") || "",
        guests: formData.get("guests") || "",
        location: formData.get("location") || "",
      };
    }

    return body;
  }

  function handleSubmit(formData: FormData) {
    setError(null);

    if (!file) {
      setError("Bitte zuerst den Originalbeleg hochladen.");
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
      uploadData.append("file", file);
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

  const hasDetectedValues = Boolean(
    ocrResult?.extracted.date
      || ocrResult?.extracted.amount !== null
      || ocrResult?.extracted.currency
      || ocrResult?.extracted.supplier,
  );

  return (
    <form action={handleSubmit} className="space-y-6">
      <Card>
        <h2 className="text-lg font-semibold tracking-tight">Belegdatei</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          JPG, PNG oder PDF hochladen (max. 20 MB). Die Originaldatei ist fuer neue Belege Pflicht. OCR wird automatisch ausgefuehrt.
        </p>
        <div className="mt-4">
          <label className={`flex cursor-pointer flex-col items-center gap-3 rounded-2xl border-2 border-dashed p-8 transition hover:border-primary/40 hover:bg-primary/5 ${file ? "border-border" : "border-accent/40"}`}>
            <span className="text-sm font-medium text-muted-foreground">
              {file ? file.name : "Datei waehlen oder hierher ziehen"}
            </span>
            <input
              type="file"
              accept="image/jpeg,image/png,application/pdf"
              capture="environment"
              onChange={handleFileChange}
              className="sr-only"
            />
            <span className="rounded-2xl border border-border bg-card px-4 py-2 text-sm font-semibold transition hover:border-primary/40 hover:text-primary">
              Datei auswaehlen
            </span>
          </label>
          {previewUrl ? (
            <img src={previewUrl} alt="Vorschau" className="mt-4 max-h-64 rounded-xl object-contain" />
          ) : null}
          {ocrRunning ? (
            <p className="mt-3 text-sm text-muted-foreground">OCR laeuft...</p>
          ) : null}
          {ocrResult ? (
            <div className="mt-3 rounded-xl border border-primary/20 bg-primary/5 p-3">
              <p className="text-xs font-semibold text-primary">
                {getOcrHeadline(ocrResult.sourceType)}
              </p>
              {ocrResult.message ? (
                <p className="mt-1 text-xs text-muted-foreground">{ocrResult.message}</p>
              ) : null}
              {hasDetectedValues ? (
                <div className="mt-2 grid grid-cols-2 gap-1 text-xs text-muted-foreground">
                  {ocrResult.extracted.date ? <OcrField label="Datum" value={ocrResult.extracted.date} confidence={ocrResult.fieldConfidence.date} /> : null}
                  {ocrResult.extracted.amount !== null ? <OcrField label="Betrag" value={String(ocrResult.extracted.amount)} confidence={ocrResult.fieldConfidence.amount} /> : null}
                  {ocrResult.extracted.currency ? <OcrField label="Waehrung" value={ocrResult.extracted.currency} confidence={ocrResult.fieldConfidence.currency} /> : null}
                  {ocrResult.extracted.supplier ? <OcrField label="Lieferant" value={ocrResult.extracted.supplier} confidence={ocrResult.fieldConfidence.supplier} /> : null}
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
          <SelectField label="Land" name="countryId" value={countryId} onChange={setCountryId}>
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
          <h2 className="text-lg font-semibold tracking-tight">Bewirtungsangaben</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Diese Felder sind bei Bewirtungsbelegen Pflicht.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Input label="Anlass" name="occasion" required placeholder="z.B. Projektbesprechung" />
            <label className="grid gap-1 text-sm font-medium">
              <span className="text-xs text-muted-foreground">Gaeste / Teilnehmer</span>
              <textarea
                name="guests"
                required
                rows={2}
                placeholder="Hr. Mueller, Fr. Schmidt"
                className="rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
              />
            </label>
            <Input label="Ort" name="location" required placeholder="z.B. Restaurant Adria, Berlin" />
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
          disabled={isPending}
          className="rounded-2xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? "Wird gespeichert..." : "Speichern"}
        </button>
        <button
          type="submit"
          name="_action"
          value="save_next"
          disabled={isPending}
          className="rounded-2xl border border-border bg-card px-6 py-3 text-sm font-semibold transition hover:border-primary/40 hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? "Wird vorbereitet..." : "Speichern & naechsten Beleg erfassen"}
        </button>
        <button
          type="submit"
          name="_action"
          value="send"
          disabled={isPending}
          className="rounded-2xl border border-primary bg-primary/10 px-6 py-3 text-sm font-semibold text-primary transition hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? "Wird gesendet..." : "Speichern & Senden"}
        </button>
      </div>
    </form>
  );
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

const CONFIDENCE_INDICATOR: Record<string, string> = {
  high: "text-primary",
  medium: "text-accent-foreground",
  low: "text-danger",
  none: "text-muted-foreground",
};

function getOcrHeadline(sourceType: OcrResult["sourceType"]): string {
  switch (sourceType) {
    case "pdf-text":
      return "PDF-Text erkannt und als Vorschlag vorbelegt; manuelle Eingaben bleiben erhalten";
    case "pdf-scan":
      return "Scan-PDF per OCR analysiert; manuelle Eingaben bleiben erhalten";
    case "pdf-empty":
      return "Fuer dieses PDF konnten keine verlaesslichen OCR-Vorschlaege erzeugt werden";
    default:
      return "OCR-Ergebnisse als Vorschlag vorbelegt; manuelle Eingaben bleiben erhalten";
  }
}

function OcrField({ label, value, confidence }: { label: string; value: string; confidence?: keyof typeof CONFIDENCE_INDICATOR }) {
  const currentConfidence = confidence ?? "none";
  return (
    <span className={CONFIDENCE_INDICATOR[currentConfidence] ?? "text-muted-foreground"}>
      {label}: {value} {currentConfidence === "high" ? "" : currentConfidence === "medium" ? "(~)" : currentConfidence === "low" ? "(?)" : ""}
    </span>
  );
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
