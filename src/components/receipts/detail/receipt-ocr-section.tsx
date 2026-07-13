import { Card } from "@/components/ui/card";
import { documentTypeLabels, paymentMethodLabels, type OcrDocumentType } from "@/lib/ocr-suggestions";
import { Field } from "./field";
import { formatSuggestedValue, type StructuredData } from "./parse-structured-data";

type ReceiptOcrSectionProps = {
  structuredData: StructuredData | null;
  detectedDocumentType: OcrDocumentType | null;
};

export function ReceiptOcrSection({ structuredData, detectedDocumentType }: ReceiptOcrSectionProps) {
  if (!structuredData && !detectedDocumentType) return null;

  return (
    <Card>
      <h2 className="text-lg font-semibold tracking-tight">KI-Vorschlaege</h2>
      <div className="mt-4 space-y-4 text-sm">
        {detectedDocumentType ? (
          <Field label="Erkannter Belegtyp" value={documentTypeLabels[detectedDocumentType]} />
        ) : null}
        {structuredData ? (
          <>
            <div className="grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
              {structuredData.extracted.time ? <Field label="Uhrzeit" value={formatSuggestedValue(structuredData.extracted.time, structuredData.fieldReviewStates?.time, structuredData.fieldConfidence.time)} /> : null}
              {structuredData.extracted.invoiceDate ? <Field label="Rechnungsdatum" value={formatSuggestedValue(structuredData.extracted.invoiceDate, structuredData.fieldReviewStates?.invoiceDate, structuredData.fieldConfidence.invoiceDate)} /> : null}
              {structuredData.extracted.invoiceNumber ? <Field label="Rechnungsnummer" value={formatSuggestedValue(structuredData.extracted.invoiceNumber, structuredData.fieldReviewStates?.invoiceNumber, structuredData.fieldConfidence.invoiceNumber)} /> : null}
              {structuredData.extracted.grossAmount !== null ? <Field label="Rechnungsbetrag" value={formatSuggestedValue(structuredData.extracted.grossAmount.toFixed(2), structuredData.fieldReviewStates?.grossAmount, structuredData.fieldConfidence.grossAmount)} /> : null}
              {structuredData.extracted.netAmount !== null ? <Field label="Nettobetrag" value={formatSuggestedValue(structuredData.extracted.netAmount.toFixed(2), structuredData.fieldReviewStates?.netAmount, structuredData.fieldConfidence.netAmount)} /> : null}
              {structuredData.extracted.taxAmount !== null ? <Field label="Steuerbetrag" value={formatSuggestedValue(structuredData.extracted.taxAmount.toFixed(2), structuredData.fieldReviewStates?.taxAmount, structuredData.fieldConfidence.taxAmount)} /> : null}
              {structuredData.extracted.location ? <Field label="Ort / Standort" value={formatSuggestedValue(structuredData.extracted.location, structuredData.fieldReviewStates?.location, structuredData.fieldConfidence.location)} /> : null}
              {structuredData.extracted.countryName ? <Field label="Erkanntes Land" value={formatSuggestedValue(structuredData.extracted.countryName, structuredData.fieldReviewStates?.country, structuredData.fieldConfidence.country)} /> : null}
              {structuredData.extracted.paymentMethod ? <Field label="Zahlungsart" value={formatSuggestedValue(paymentMethodLabels[structuredData.extracted.paymentMethod], structuredData.fieldReviewStates?.paymentMethod, structuredData.fieldConfidence.paymentMethod)} /> : null}
              {structuredData.extracted.cardLastDigits ? <Field label="Kartenendziffern" value={formatSuggestedValue(`**** ${structuredData.extracted.cardLastDigits}`, structuredData.fieldReviewStates?.cardLastDigits, structuredData.fieldConfidence.cardLastDigits)} /> : null}
            </div>
            {structuredData.special.invoice ? (
              <div className="rounded-xl border border-border/70 bg-muted/30 p-4">
                <p className="text-sm font-semibold">Rechnungspositionen</p>
                <div className="mt-3 space-y-2">
                  {structuredData.special.invoice.lineItems.map((item, index) => (
                    <div key={`${item.description}-${index}`} className="rounded-xl border border-border bg-background px-3 py-2 text-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium">{item.lineNumber ? `${item.lineNumber}. ` : ""}{item.description}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {[
                              item.quantity !== null ? `Menge ${item.quantity}` : null,
                              item.unit ? `Einheit ${item.unit}` : null,
                              item.unitPrice !== null ? `Einzelpreis ${item.unitPrice.toFixed(2)}` : null,
                              item.taxHint ? `Steuer ${item.taxHint}` : null,
                            ].filter(Boolean).join(" / ") || "Teilweise erkannt"}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">{item.totalPrice !== null ? formatSuggestedValue(item.totalPrice.toFixed(2), structuredData.fieldReviewStates?.invoiceLineItems, item.confidence) : "-"}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{item.status === "confident" ? "sicher" : item.status === "uncertain" ? "pruefen" : "teilweise"}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            {structuredData.special.fuel ? (
              <div className="rounded-xl border border-border/70 bg-muted/30 p-4">
                <p className="text-sm font-semibold">Tankhinweise</p>
                <div className="mt-3 grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
                  {structuredData.special.fuel.liters !== null ? <Field label="Liter" value={formatSuggestedValue(structuredData.special.fuel.liters.toFixed(2), structuredData.fieldReviewStates?.fuelLiters, structuredData.specialConfidence.fuel?.liters ?? "none")} /> : null}
                  {structuredData.special.fuel.pricePerLiter !== null ? <Field label="Preis pro Liter" value={formatSuggestedValue(structuredData.special.fuel.pricePerLiter.toFixed(3), structuredData.fieldReviewStates?.fuelPricePerLiter, structuredData.specialConfidence.fuel?.pricePerLiter ?? "none")} /> : null}
                  {structuredData.special.fuel.fuelType ? <Field label="Kraftstoffart" value={formatSuggestedValue(structuredData.special.fuel.fuelType, structuredData.fieldReviewStates?.fuelType, structuredData.specialConfidence.fuel?.fuelType ?? "none")} /> : null}
                </div>
              </div>
            ) : null}
            {structuredData.special.hospitality ? (
              <div className="rounded-xl border border-border/70 bg-muted/30 p-4">
                <p className="text-sm font-semibold">Bewirtungshinweise</p>
                <div className="mt-3 grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
                  {structuredData.special.hospitality.location ? <Field label="Ort" value={formatSuggestedValue(structuredData.special.hospitality.location, structuredData.fieldReviewStates?.hospitalityLocation, structuredData.specialConfidence.hospitality?.location ?? "none")} /> : null}
                  {structuredData.special.hospitality.subtotal !== null ? <Field label="Zwischensumme" value={formatSuggestedValue(structuredData.special.hospitality.subtotal.toFixed(2), structuredData.fieldReviewStates?.hospitalitySubtotal, structuredData.specialConfidence.hospitality?.subtotal ?? "none")} /> : null}
                  {structuredData.special.hospitality.tip !== null ? <Field label="Trinkgeld" value={formatSuggestedValue(structuredData.special.hospitality.tip.toFixed(2), structuredData.fieldReviewStates?.hospitalityTip, structuredData.specialConfidence.hospitality?.tip ?? "none")} /> : null}
                </div>
                {structuredData.special.hospitality.lineItems.length > 0 ? (
                  <div className="mt-3 space-y-2">
                    <p className="text-xs text-muted-foreground">Erkannte Positionen</p>
                    {structuredData.special.hospitality.lineItems.map((item, index) => (
                      <div key={`${item.label}-${index}`} className="flex items-center justify-between rounded-xl border border-border bg-background px-3 py-2 text-sm">
                        <span>{item.label}</span>
                        <span>{item.amount !== null ? item.amount.toFixed(2) : "-"}</span>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
            {structuredData.special.lodging ? (
              <div className="rounded-xl border border-border/70 bg-muted/30 p-4">
                <p className="text-sm font-semibold">Unterkunftshinweise</p>
                <div className="mt-3 grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
                  {structuredData.special.lodging.location ? <Field label="Ort" value={formatSuggestedValue(structuredData.special.lodging.location, structuredData.fieldReviewStates?.lodgingLocation, structuredData.specialConfidence.lodging?.location ?? "none")} /> : null}
                  {structuredData.special.lodging.nights !== null ? <Field label="Naechte" value={formatSuggestedValue(String(structuredData.special.lodging.nights), structuredData.fieldReviewStates?.lodgingNights, structuredData.specialConfidence.lodging?.nights ?? "none")} /> : null}
                  {structuredData.special.lodging.subtotal !== null ? <Field label="Zwischensumme" value={formatSuggestedValue(structuredData.special.lodging.subtotal.toFixed(2), structuredData.fieldReviewStates?.lodgingSubtotal, structuredData.specialConfidence.lodging?.subtotal ?? "none")} /> : null}
                  {structuredData.special.lodging.tax !== null ? <Field label="Tax / Kurtaxe" value={formatSuggestedValue(structuredData.special.lodging.tax.toFixed(2), structuredData.fieldReviewStates?.lodgingTax, structuredData.specialConfidence.lodging?.tax ?? "none")} /> : null}
                  {structuredData.special.lodging.fees !== null ? <Field label="Gebuehren" value={formatSuggestedValue(structuredData.special.lodging.fees.toFixed(2), structuredData.fieldReviewStates?.lodgingFees, structuredData.specialConfidence.lodging?.fees ?? "none")} /> : null}
                </div>
                {structuredData.special.lodging.lineItems.length > 0 ? (
                  <div className="mt-3 space-y-2">
                    <p className="text-xs text-muted-foreground">Erkannte Zusatzpositionen</p>
                    {structuredData.special.lodging.lineItems.map((item, index) => (
                      <div key={`${item.label}-${index}`} className="flex items-center justify-between rounded-xl border border-border bg-background px-3 py-2 text-sm">
                        <span>{item.label}</span>
                        <span>{item.amount !== null ? item.amount.toFixed(2) : "-"}</span>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
            {structuredData.special.parking ? (
              <div className="rounded-xl border border-border/70 bg-muted/30 p-4">
                <p className="text-sm font-semibold">Parkhinweise</p>
                <div className="mt-3 grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
                  {structuredData.special.parking.location ? <Field label="Ort" value={formatSuggestedValue(structuredData.special.parking.location, structuredData.fieldReviewStates?.parkingLocation, structuredData.specialConfidence.parking?.location ?? "none")} /> : null}
                  {structuredData.special.parking.durationText ? <Field label="Dauer" value={formatSuggestedValue(structuredData.special.parking.durationText, structuredData.fieldReviewStates?.parkingDuration, structuredData.specialConfidence.parking?.durationText ?? "none")} /> : null}
                  {structuredData.special.parking.entryTime ? <Field label="Einfahrt" value={formatSuggestedValue(structuredData.special.parking.entryTime, structuredData.fieldReviewStates?.parkingEntryTime, structuredData.specialConfidence.parking?.entryTime ?? "none")} /> : null}
                  {structuredData.special.parking.exitTime ? <Field label="Ausfahrt" value={formatSuggestedValue(structuredData.special.parking.exitTime, structuredData.fieldReviewStates?.parkingExitTime, structuredData.specialConfidence.parking?.exitTime ?? "none")} /> : null}
                </div>
              </div>
            ) : null}
            {structuredData.special.toll ? (
              <div className="rounded-xl border border-border/70 bg-muted/30 p-4">
                <p className="text-sm font-semibold">Mauthinweise</p>
                <div className="mt-3 grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
                  {structuredData.special.toll.station ? <Field label="Station / Anbieter" value={formatSuggestedValue(structuredData.special.toll.station, structuredData.fieldReviewStates?.tollStation, structuredData.specialConfidence.toll?.station ?? "none")} /> : null}
                  {structuredData.special.toll.routeHint ? <Field label="Streckenhinweis" value={formatSuggestedValue(structuredData.special.toll.routeHint, structuredData.fieldReviewStates?.tollRouteHint, structuredData.specialConfidence.toll?.routeHint ?? "none")} /> : null}
                  {structuredData.special.toll.vehicleClass ? <Field label="Fahrzeugklasse" value={formatSuggestedValue(structuredData.special.toll.vehicleClass, structuredData.fieldReviewStates?.tollVehicleClass, structuredData.specialConfidence.toll?.vehicleClass ?? "none")} /> : null}
                </div>
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </Card>
  );
}
