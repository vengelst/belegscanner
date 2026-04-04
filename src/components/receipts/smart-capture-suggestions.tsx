import type { OcrInvoiceLineItem, OcrResult } from "@/lib/document-analysis";
import {
  documentTypeLabels,
  fieldReviewStatusLabels,
  formatConfidenceLabel,
  paymentMethodLabels,
  type OcrConfidenceLevel,
  type OcrFieldReviewStatus,
} from "@/lib/ocr-suggestions";

const STATUS_STYLES: Record<OcrFieldReviewStatus, string> = {
  detected_confident: "border-primary/30 bg-primary/5 text-primary",
  detected_uncertain: "border-accent/40 bg-accent/10 text-accent-foreground",
  not_detected: "border-border bg-muted/40 text-muted-foreground",
  user_confirmed: "border-emerald-300 bg-emerald-50 text-emerald-700",
  user_overridden: "border-sky-300 bg-sky-50 text-sky-700",
};

type Props = {
  ocrResult: OcrResult;
  purposeSuggestion?: {
    id: string;
    label: string;
    reason: string;
  } | null;
  countrySuggestion?: {
    id: string;
    label: string;
    reason: string;
  } | null;
  currentPurposeId?: string;
  currentCountryId?: string;
  fieldReviewStates?: Partial<Record<string, OcrFieldReviewStatus>>;
  onApplySuggestedPurpose?: (purposeId: string) => void;
  onApplySuggestedCountry?: (countryId: string) => void;
};

export function SmartCaptureSuggestions({
  ocrResult,
  purposeSuggestion,
  countrySuggestion,
  currentPurposeId,
  currentCountryId,
  fieldReviewStates,
  onApplySuggestedPurpose,
  onApplySuggestedCountry,
}: Props) {
  const formatMoney = (value: number | null) => value !== null ? `${value.toFixed(2)} ${ocrResult.extracted.currency ?? ""}`.trim() : null;

  const generalItems = [
    { key: "documentType", label: "Belegtyp", value: ocrResult.extracted.documentType ? documentTypeLabels[ocrResult.extracted.documentType] : null, confidence: ocrResult.fieldConfidence.documentType },
    { key: "date", label: "Datum", value: ocrResult.extracted.date, confidence: ocrResult.fieldConfidence.date },
    { key: "invoiceDate", label: "Rechnungsdatum", value: ocrResult.extracted.invoiceDate, confidence: ocrResult.fieldConfidence.invoiceDate },
    { key: "time", label: "Uhrzeit", value: ocrResult.extracted.time, confidence: ocrResult.fieldConfidence.time },
    { key: "supplier", label: "Lieferant", value: ocrResult.extracted.supplier, confidence: ocrResult.fieldConfidence.supplier },
    { key: "invoiceNumber", label: "Rechnungsnummer", value: ocrResult.extracted.invoiceNumber, confidence: ocrResult.fieldConfidence.invoiceNumber },
    { key: "location", label: "Ort", value: ocrResult.extracted.location, confidence: ocrResult.fieldConfidence.location },
    { key: "country", label: "Land", value: ocrResult.extracted.countryName, confidence: ocrResult.fieldConfidence.country },
    { key: "amount", label: "Betrag", value: formatMoney(ocrResult.extracted.amount), confidence: ocrResult.fieldConfidence.amount },
    { key: "grossAmount", label: "Bruttobetrag", value: formatMoney(ocrResult.extracted.grossAmount), confidence: ocrResult.fieldConfidence.grossAmount },
    { key: "netAmount", label: "Nettobetrag", value: formatMoney(ocrResult.extracted.netAmount), confidence: ocrResult.fieldConfidence.netAmount },
    { key: "taxAmount", label: "Steuerbetrag", value: formatMoney(ocrResult.extracted.taxAmount), confidence: ocrResult.fieldConfidence.taxAmount },
    { key: "currency", label: "Waehrung", value: ocrResult.extracted.currency, confidence: ocrResult.fieldConfidence.currency },
    { key: "paymentMethod", label: "Zahlungsart", value: ocrResult.extracted.paymentMethod ? paymentMethodLabels[ocrResult.extracted.paymentMethod] : null, confidence: ocrResult.fieldConfidence.paymentMethod },
    { key: "cardLastDigits", label: "Kartenendziffern", value: ocrResult.extracted.cardLastDigits ? `**** ${ocrResult.extracted.cardLastDigits}` : null, confidence: ocrResult.fieldConfidence.cardLastDigits },
  ].filter((item) => item.value);

  return (
    <div className="space-y-3">
      {generalItems.length > 0 ? (
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {generalItems.map((item) => (
            <SuggestionPill
              key={item.key}
              label={item.label}
              value={String(item.value)}
              confidence={item.confidence}
              status={fieldReviewStates?.[item.key]}
            />
          ))}
        </div>
      ) : null}

      {purposeSuggestion && onApplySuggestedPurpose && purposeSuggestion.id !== currentPurposeId ? (
        <ActionSuggestionCard text={`Die KI erkennt wahrscheinlich ${purposeSuggestion.reason}. Du kannst den Zweck auf ${purposeSuggestion.label} setzen, falls das passt.`} buttonLabel="Zweck uebernehmen" onClick={() => onApplySuggestedPurpose(purposeSuggestion.id)} />
      ) : null}

      {countrySuggestion && onApplySuggestedCountry && countrySuggestion.id !== currentCountryId ? (
        <ActionSuggestionCard text={`Land wirkt plausibel als ${countrySuggestion.label}. Bitte pruefen oder direkt uebernehmen.`} buttonLabel="Land uebernehmen" onClick={() => onApplySuggestedCountry(countrySuggestion.id)} />
      ) : null}

      {ocrResult.special.invoice ? (
        <SpecialSuggestionCard title="Rechnungspositionen" status={fieldReviewStates?.invoiceLineItems} confidence={ocrResult.specialConfidence.invoice?.lineItems ?? "none"}>
          <InvoiceLineItemList items={ocrResult.special.invoice.lineItems} currency={ocrResult.extracted.currency} />
        </SpecialSuggestionCard>
      ) : null}

      {ocrResult.special.fuel ? (
        <SpecialSuggestionCard title="Tankhinweise" status={fieldReviewStates?.documentType} confidence={ocrResult.fieldConfidence.documentType}>
          <div className="grid gap-2 sm:grid-cols-2">
            <SuggestionPill label="Liter" value={formatNullableNumber(ocrResult.special.fuel.liters)} confidence={ocrResult.specialConfidence.fuel?.liters ?? "none"} status={fieldReviewStates?.fuelLiters} />
            <SuggestionPill label="Preis pro Liter" value={formatNullableNumber(ocrResult.special.fuel.pricePerLiter)} confidence={ocrResult.specialConfidence.fuel?.pricePerLiter ?? "none"} status={fieldReviewStates?.fuelPricePerLiter} />
            <SuggestionPill label="Kraftstoffart" value={ocrResult.special.fuel.fuelType ?? "-"} confidence={ocrResult.specialConfidence.fuel?.fuelType ?? "none"} status={fieldReviewStates?.fuelType} />
            <SuggestionPill label="Gesamtbetrag" value={ocrResult.extracted.amount !== null ? `${ocrResult.extracted.amount.toFixed(2)} ${ocrResult.extracted.currency ?? ""}`.trim() : "-"} confidence={ocrResult.fieldConfidence.amount} status={fieldReviewStates?.amount} />
          </div>
        </SpecialSuggestionCard>
      ) : null}

      {ocrResult.special.hospitality ? (
        <SpecialSuggestionCard title="Bewirtungshinweise" status={fieldReviewStates?.documentType} confidence={ocrResult.fieldConfidence.documentType}>
          <div className="grid gap-2 sm:grid-cols-2">
            <SuggestionPill label="Ort" value={ocrResult.special.hospitality.location ?? "-"} confidence={ocrResult.specialConfidence.hospitality?.location ?? "none"} status={fieldReviewStates?.hospitalityLocation} />
            <SuggestionPill label="Zwischensumme" value={formatNullableNumber(ocrResult.special.hospitality.subtotal)} confidence={ocrResult.specialConfidence.hospitality?.subtotal ?? "none"} status={fieldReviewStates?.hospitalitySubtotal} />
            <SuggestionPill label="Trinkgeld" value={formatNullableNumber(ocrResult.special.hospitality.tip)} confidence={ocrResult.specialConfidence.hospitality?.tip ?? "none"} status={fieldReviewStates?.hospitalityTip} />
          </div>
          <LineItemList items={ocrResult.special.hospitality.lineItems} title="Erkannte Positionen" />
        </SpecialSuggestionCard>
      ) : null}

      {ocrResult.special.lodging ? (
        <SpecialSuggestionCard title="Unterkunftshinweise" status={fieldReviewStates?.documentType} confidence={ocrResult.fieldConfidence.documentType}>
          <div className="grid gap-2 sm:grid-cols-2">
            <SuggestionPill label="Ort" value={ocrResult.special.lodging.location ?? "-"} confidence={ocrResult.specialConfidence.lodging?.location ?? "none"} status={fieldReviewStates?.lodgingLocation} />
            <SuggestionPill label="Naechte" value={ocrResult.special.lodging.nights !== null ? String(ocrResult.special.lodging.nights) : "-"} confidence={ocrResult.specialConfidence.lodging?.nights ?? "none"} status={fieldReviewStates?.lodgingNights} />
            <SuggestionPill label="Zwischensumme" value={formatNullableNumber(ocrResult.special.lodging.subtotal)} confidence={ocrResult.specialConfidence.lodging?.subtotal ?? "none"} status={fieldReviewStates?.lodgingSubtotal} />
            <SuggestionPill label="Tax / Kurtaxe" value={formatNullableNumber(ocrResult.special.lodging.tax)} confidence={ocrResult.specialConfidence.lodging?.tax ?? "none"} status={fieldReviewStates?.lodgingTax} />
            <SuggestionPill label="Gebuehren" value={formatNullableNumber(ocrResult.special.lodging.fees)} confidence={ocrResult.specialConfidence.lodging?.fees ?? "none"} status={fieldReviewStates?.lodgingFees} />
          </div>
          <LineItemList items={ocrResult.special.lodging.lineItems} title="Erkannte Zusatzpositionen" />
        </SpecialSuggestionCard>
      ) : null}

      {ocrResult.special.parking ? (
        <SpecialSuggestionCard title="Parkhinweise" status={fieldReviewStates?.documentType} confidence={ocrResult.fieldConfidence.documentType}>
          <div className="grid gap-2 sm:grid-cols-2">
            <SuggestionPill label="Ort" value={ocrResult.special.parking.location ?? "-"} confidence={ocrResult.specialConfidence.parking?.location ?? "none"} status={fieldReviewStates?.parkingLocation} />
            <SuggestionPill label="Dauer" value={ocrResult.special.parking.durationText ?? "-"} confidence={ocrResult.specialConfidence.parking?.durationText ?? "none"} status={fieldReviewStates?.parkingDuration} />
            <SuggestionPill label="Einfahrt" value={ocrResult.special.parking.entryTime ?? "-"} confidence={ocrResult.specialConfidence.parking?.entryTime ?? "none"} status={fieldReviewStates?.parkingEntryTime} />
            <SuggestionPill label="Ausfahrt" value={ocrResult.special.parking.exitTime ?? "-"} confidence={ocrResult.specialConfidence.parking?.exitTime ?? "none"} status={fieldReviewStates?.parkingExitTime} />
          </div>
        </SpecialSuggestionCard>
      ) : null}

      {ocrResult.special.toll ? (
        <SpecialSuggestionCard title="Mauthinweise" status={fieldReviewStates?.documentType} confidence={ocrResult.fieldConfidence.documentType}>
          <div className="grid gap-2 sm:grid-cols-2">
            <SuggestionPill label="Station / Anbieter" value={ocrResult.special.toll.station ?? "-"} confidence={ocrResult.specialConfidence.toll?.station ?? "none"} status={fieldReviewStates?.tollStation} />
            <SuggestionPill label="Streckenhinweis" value={ocrResult.special.toll.routeHint ?? "-"} confidence={ocrResult.specialConfidence.toll?.routeHint ?? "none"} status={fieldReviewStates?.tollRouteHint} />
            <SuggestionPill label="Fahrzeugklasse" value={ocrResult.special.toll.vehicleClass ?? "-"} confidence={ocrResult.specialConfidence.toll?.vehicleClass ?? "none"} status={fieldReviewStates?.tollVehicleClass} />
          </div>
        </SpecialSuggestionCard>
      ) : null}
    </div>
  );
}

function ActionSuggestionCard({ text, buttonLabel, onClick }: { text: string; buttonLabel: string; onClick: () => void }) {
  return (
    <div className="rounded-xl border border-accent/40 bg-background/70 p-3 text-xs text-muted-foreground">
      <p>{text}</p>
      <div className="mt-2">
        <button
          type="button"
          onClick={onClick}
          className="rounded-2xl border border-border bg-card px-3 py-2 text-xs font-semibold transition hover:border-primary/40 hover:text-primary"
        >
          {buttonLabel}
        </button>
      </div>
    </div>
  );
}

function SpecialSuggestionCard({ title, status, confidence, children }: { title: string; status?: OcrFieldReviewStatus; confidence: OcrConfidenceLevel; children: React.ReactNode }) {
  const currentStatus = status ?? confidenceToDisplayStatus(confidence);
  return (
    <div className="rounded-xl border border-border/80 bg-background/60 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-foreground">{title}</p>
        <span className={`rounded-full border px-2 py-1 text-[11px] font-semibold ${STATUS_STYLES[currentStatus]}`}>{fieldReviewStatusLabels[currentStatus]}</span>
      </div>
      {children}
    </div>
  );
}

function LineItemList({ items, title }: { items: Array<{ label: string; amount: number | null }>; title: string }) {
  if (items.length === 0) return null;

  return (
    <div className="mt-3 space-y-1 text-xs text-muted-foreground">
      <p className="font-semibold text-foreground">{title}</p>
      {items.map((item, index) => (
        <div key={`${item.label}-${index}`} className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-background/70 px-3 py-2">
          <span>{item.label}</span>
          <span>{item.amount !== null ? item.amount.toFixed(2) : "-"}</span>
        </div>
      ))}
    </div>
  );
}

function InvoiceLineItemList({ items, currency }: { items: OcrInvoiceLineItem[]; currency: string | null }) {
  if (!items || items.length === 0) return null;

  return (
    <div className="mt-3 space-y-2 text-xs text-muted-foreground">
      <p className="font-semibold text-foreground">Erkannte Positionen</p>
      {items.map((item, index) => (
        <div key={`${item.description}-${index}`} className="rounded-xl border border-border/70 bg-background/70 px-3 py-2">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-foreground">{item.lineNumber ? `${item.lineNumber}. ` : ""}{item.description}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {[
                  item.quantity !== null ? `Menge ${item.quantity}` : null,
                  item.unit ? `Einheit ${item.unit}` : null,
                  item.unitPrice !== null ? `Einzelpreis ${item.unitPrice.toFixed(2)} ${currency ?? ""}`.trim() : null,
                  item.taxHint ? `Steuer ${item.taxHint}` : null,
                ].filter(Boolean).join(" / ") || "Teilweise erkannt"}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold text-foreground">{item.totalPrice !== null ? `${item.totalPrice.toFixed(2)} ${currency ?? ""}`.trim() : "-"}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">{item.status === "confident" ? "sicher" : item.status === "uncertain" ? "pruefen" : "teilweise"}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function SuggestionPill({ label, value, confidence, status }: { label: string; value: string; confidence: OcrConfidenceLevel; status?: OcrFieldReviewStatus }) {
  const currentStatus = status ?? confidenceToDisplayStatus(confidence);
  return (
    <div className="rounded-xl border border-border/70 bg-background/70 px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</span>
        <span className={`rounded-full border px-2 py-1 text-[11px] font-semibold ${STATUS_STYLES[currentStatus]}`}>{fieldReviewStatusLabels[currentStatus]}</span>
      </div>
      <p className="mt-1 text-sm font-medium text-foreground">{value}</p>
      {!status ? <p className="mt-1 text-[11px] text-muted-foreground">KI {formatConfidenceLabel(confidence)}</p> : null}
    </div>
  );
}

function confidenceToDisplayStatus(confidence: OcrConfidenceLevel): OcrFieldReviewStatus {
  if (confidence === "high") return "detected_confident";
  if (confidence === "medium" || confidence === "low") return "detected_uncertain";
  return "not_detected";
}

function formatNullableNumber(value: number | null) {
  return value !== null ? value.toFixed(2) : "-";
}
