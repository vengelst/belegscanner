import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { SendActions } from "@/components/receipts/send-actions";
import { SendLogTable } from "@/components/receipts/send-log-table";
import { ReviewActions } from "@/components/receipts/review-actions";
import { ReceiptComments } from "@/components/receipts/receipt-comments";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import Link from "next/link";
import { connection } from "next/server";
import { documentTypeLabels, fieldReviewStatusLabels, fromReceiptDocumentType, paymentMethodLabels, type OcrFieldReviewStatus } from "@/lib/ocr-suggestions";
import { checkSendReadiness } from "@/lib/validation";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function ReceiptDetailPage({ params }: Props) {
  await connection();
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { id } = await params;

  const receipt = await prisma.receipt.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true } },
      country: { select: { name: true, code: true } },
      vehicle: { select: { plate: true, description: true } },
      purpose: { select: { name: true, isHospitality: true } },
      category: { select: { name: true } },
      datevProfile: { select: { name: true } },
      reviewedBy: { select: { name: true } },
      hospitality: true,
      files: { where: { type: "ORIGINAL" } },
      sendLogs: { orderBy: { createdAt: "desc" }, take: 20 },
    },
  });

  if (!receipt) notFound();

  if (session.user.role !== "ADMIN" && receipt.userId !== session.user.id) {
    notFound();
  }

  // Load active DATEV profiles for send action
  const datevProfiles = await prisma.datevProfile.findMany({
    where: { active: true },
    select: { id: true, name: true, isDefault: true },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
  });

  const originalFile = receipt.files[0] ?? null;
  const isImage = originalFile?.mimeType.startsWith("image/");
  const fmtDate = (d: Date) => format(d, "dd.MM.yyyy", { locale: de });
  const fmtAmount = (a: unknown) => {
    const n = Number(a);
    return isNaN(n) ? "—" : n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const lastLog = receipt.sendLogs[0] ?? null;
  const structuredData = parseStructuredData(receipt.aiStructuredData);
  const detectedDocumentType = fromReceiptDocumentType(receipt.aiDocumentType);
  const detectedPaymentMethod = structuredData?.extracted.paymentMethod
    ? paymentMethodLabels[structuredData.extracted.paymentMethod]
    : null;
  const detectedCardLastDigits = structuredData?.extracted.cardLastDigits
    ? `**** ${structuredData.extracted.cardLastDigits}`
    : null;

  const smtpConfigured = await prisma.smtpConfig.findUnique({ where: { id: "default" }, select: { id: true } });

  const readiness = checkSendReadiness({
    date: receipt.date,
    amount: Number(receipt.amount),
    currency: receipt.currency,
    supplier: receipt.supplier,
    invoiceNumber: receipt.invoiceNumber,
    netAmount: receipt.netAmount ? Number(receipt.netAmount) : null,
    taxAmount: receipt.taxAmount ? Number(receipt.taxAmount) : null,
    countryId: receipt.countryId,
    purposeId: receipt.purposeId,
    categoryId: receipt.categoryId,
    exchangeRate: receipt.exchangeRate ? Number(receipt.exchangeRate) : null,
    hasFile: receipt.files.length > 0,
    hasSmtp: !!smtpConfigured,
    hasDatev: datevProfiles.length > 0,
  });

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href="/receipts"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition hover:text-primary"
      >
        &larr; Zurueck zur Liste
      </Link>

      {/* Warnings */}
      {receipt.purpose.isHospitality && !receipt.hospitality ? (
        <div className="rounded-2xl border border-danger/30 bg-danger/5 p-4">
          <p className="text-sm font-medium text-danger">
            Bewirtungsangaben fehlen. Dieser Beleg erfordert Anlass, Gaeste und Ort.
            <Link href={`/receipts/${receipt.id}/edit`} className="ml-1 underline">Jetzt ergaenzen</Link>
          </p>
        </div>
      ) : null}
      {!originalFile ? (
        <div className="rounded-2xl border border-accent/30 bg-accent/5 p-4">
          <p className="text-sm font-medium text-accent-foreground">
            Keine Belegdatei vorhanden. Versand und Einreichung sind ohne Datei nicht moeglich.
            <Link href={`/receipts/${receipt.id}/edit`} className="ml-1 underline">Datei nachreichen</Link>
          </p>
        </div>
      ) : null}
      {receipt.currency !== "EUR" && !receipt.exchangeRate ? (
        <div className="rounded-2xl border border-accent/30 bg-accent/5 p-4">
          <p className="text-sm font-medium text-accent-foreground">
            Wechselkurs fehlt fuer Fremdwaehrung {receipt.currency}.
            <Link href={`/receipts/${receipt.id}/edit`} className="ml-1 underline">Jetzt ergaenzen</Link>
          </p>
        </div>
      ) : null}

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="text-sm font-medium uppercase tracking-[0.24em] text-muted-foreground">Beleg</p>
          <h1 className="text-3xl font-semibold tracking-tight">
            {receipt.supplier ?? "Beleg"} — {fmtDate(receipt.date)}
          </h1>
          <p className="text-sm text-muted-foreground">
            Erfasst von {receipt.user.name} am {fmtDate(receipt.createdAt)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={receipt.sendStatus} />
          <Link
            href={`/receipts/${receipt.id}/edit`}
            className="rounded-2xl border border-border bg-card px-4 py-2 text-sm font-semibold transition hover:border-primary/40 hover:text-primary"
          >
            Bearbeiten
          </Link>
          <Link
            href={`/receipts/${receipt.id}/print`}
            target="_blank"
            className="rounded-2xl border border-border bg-card px-4 py-2 text-sm font-semibold transition hover:border-primary/40 hover:text-primary"
          >
            Druckansicht
          </Link>
          <a
            href={`/api/receipts/${receipt.id}/pdf`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-2xl border border-border bg-card px-4 py-2 text-sm font-semibold transition hover:border-primary/40 hover:text-primary"
          >
            PDF
          </a>
        </div>
      </div>

      {/* Review / Workflow */}
      <Card>
        <h2 className="text-lg font-semibold tracking-tight">Pruefung / Freigabe</h2>
        <div className="mt-4">
          <ReviewActions
            receiptId={receipt.id}
            reviewStatus={receipt.reviewStatus}
            isAdmin={session.user.role === "ADMIN"}
            reviewedByName={receipt.reviewedBy?.name}
            reviewedAt={receipt.reviewedAt?.toISOString()}
          />
        </div>
        {receipt.datevProfile ? (
          <p className="mt-3 text-xs text-muted-foreground">DATEV-Profil: {receipt.datevProfile.name}</p>
        ) : null}
      </Card>

      {/* Send Actions */}
      <Card>
        <h2 className="text-lg font-semibold tracking-tight">Versand</h2>
        <div className="mt-2 space-y-2 text-sm text-muted-foreground">
          {receipt.sendStatusUpdatedAt ? (
            <p>Letzter Statuswechsel: {format(receipt.sendStatusUpdatedAt, "dd.MM.yyyy, HH:mm", { locale: de })} Uhr</p>
          ) : null}
          {lastLog && !lastLog.success ? (
            <p className="font-medium text-danger">
              Letzter Fehler: {lastLog.errorMessage ?? "Unbekannter Fehler"}
            </p>
          ) : null}
        </div>
        <div className="mt-4">
          <SendActions
            receiptId={receipt.id}
            sendStatus={receipt.sendStatus}
            reviewStatus={receipt.reviewStatus}
            isAdmin={session.user.role === "ADMIN"}
            datevProfiles={datevProfiles}
            receiptDatevProfileId={receipt.datevProfileId}
            readiness={readiness}
          />
        </div>
      </Card>

      {/* Original File */}
      {originalFile ? (
        <Card>
          <h2 className="text-lg font-semibold tracking-tight">Originalbeleg</h2>
          <div className="mt-4">
            {isImage ? (
              <img
                src={`/api/files/${originalFile.id}`}
                alt="Originalbeleg"
                className="max-h-96 rounded-xl object-contain"
              />
            ) : (
              <iframe
                src={`/api/files/${originalFile.id}`}
                className="h-96 w-full rounded-xl border border-border"
                title="PDF-Vorschau"
              />
            )}
            <p className="mt-2 text-xs text-muted-foreground">
              {originalFile.filename} — {originalFile.mimeType} — {(originalFile.sizeBytes / 1024).toFixed(0)} KB
            </p>
          </div>
        </Card>
      ) : null}

      {/* Core Data */}
      <Card>
        <h2 className="text-lg font-semibold tracking-tight">Belegdaten</h2>
        <div className="mt-4 grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Belegdatum" value={fmtDate(receipt.date)} />
          {receipt.invoiceNumber ? <Field label="Rechnungsnummer" value={receipt.invoiceNumber} /> : null}
          {receipt.currency !== "EUR" ? (
            <Field label={`Rechnungsbetrag (${receipt.currency})`} value={`${fmtAmount(receipt.amount)} ${receipt.currency}`} />
          ) : null}
          {receipt.netAmount ? <Field label="Nettobetrag" value={`${fmtAmount(receipt.netAmount)} ${receipt.currency}`} /> : null}
          {receipt.taxAmount ? <Field label="Steuerbetrag" value={`${fmtAmount(receipt.taxAmount)} ${receipt.currency}`} /> : null}
          <Field label="Rechnungsbetrag (EUR)" value={`${fmtAmount(receipt.amountEur)} EUR`} />
          {receipt.currency !== "EUR" ? (
            <>
              <Field label="Wechselkurs" value={receipt.exchangeRate ? `1 EUR = ${Number(receipt.exchangeRate)} ${receipt.currency}` : "—"} />
              <Field label="Kursdatum" value={receipt.exchangeRateDate ? fmtDate(receipt.exchangeRateDate) : "—"} />
            </>
          ) : null}
          <Field label="Lieferant" value={receipt.supplier ?? "—"} />
          <Field label="Zweck" value={receipt.purpose.name} />
          <Field label="Kategorie" value={receipt.category.name} />
          <Field label="Land" value={receipt.country ? `${receipt.country.name}${receipt.country.code ? ` (${receipt.country.code})` : ""}` : "—"} />
          <Field label="Kfz" value={receipt.vehicle ? receipt.vehicle.plate : "—"} />
          {detectedPaymentMethod ? <Field label="Zahlungsart" value={detectedPaymentMethod} /> : null}
          {detectedCardLastDigits ? <Field label="Kartenendziffern" value={detectedCardLastDigits} /> : null}
          {receipt.remark ? (
            <div className="sm:col-span-2 lg:col-span-3">
              <Field label="Bemerkung" value={receipt.remark} />
            </div>
          ) : null}
        </div>
      </Card>

      {/* Hospitality */}
      {receipt.hospitality ? (
        <Card>
          <h2 className="text-lg font-semibold tracking-tight">Bewirtungsangaben</h2>
          <div className="mt-4 grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Anlass" value={receipt.hospitality.occasion} />
            <Field label="Gaeste" value={receipt.hospitality.guests} />
            <Field label="Ort" value={receipt.hospitality.location} />
          </div>
        </Card>
      ) : null}

      {/* Send Log */}
      {receipt.sendLogs.length > 0 ? (
        <Card>
          <h2 className="text-lg font-semibold tracking-tight">Versandhistorie</h2>
          <div className="mt-4">
            <SendLogTable
              logs={receipt.sendLogs.map((l) => ({
                id: l.id,
                sentAt: l.sentAt.toISOString(),
                toAddress: l.toAddress,
                success: l.success,
                errorMessage: l.errorMessage,
                messageId: l.messageId,
              }))}
            />
          </div>
        </Card>
      ) : null}

      {/* Internal Comments */}
      <Card>
        <h2 className="text-lg font-semibold tracking-tight">Interne Kommentare</h2>
        <div className="mt-4">
          <ReceiptComments receiptId={receipt.id} />
        </div>
      </Card>

      {/* KI-Auslese */}
      {structuredData || detectedDocumentType ? (
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
      ) : null}

      {/* KI-Rohtext */}
      {receipt.aiRawText ? (
        <Card>
          <h2 className="text-lg font-semibold tracking-tight">KI-Rohtext</h2>
          <pre className="mt-4 max-h-48 overflow-auto whitespace-pre-wrap rounded-xl bg-muted p-4 text-xs text-muted-foreground">
            {receipt.aiRawText}
          </pre>
        </Card>
      ) : null}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    OPEN: "bg-muted text-muted-foreground",
    READY: "bg-accent/20 text-accent-foreground",
    SENT: "bg-primary/10 text-primary",
    FAILED: "bg-danger/10 text-danger",
    RETRY: "bg-accent/20 text-accent-foreground",
  };
  return (
    <span className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${colors[status] ?? ""}`}>
      {status}
    </span>
  );
}


type StructuredData = {
  extracted: {
    time: string | null;
    invoiceDate: string | null;
    dueDate: string | null;
    serviceDate: string | null;
    location: string | null;
    paymentMethod: keyof typeof paymentMethodLabels | null;
    cardLastDigits: string | null;
    invoiceNumber: string | null;
    grossAmount: number | null;
    netAmount: number | null;
    taxAmount: number | null;
    countryName: string | null;
  };
  fieldConfidence: {
    time: string;
    invoiceDate: string;
    dueDate: string;
    serviceDate: string;
    location: string;
    paymentMethod: string;
    cardLastDigits: string;
    invoiceNumber: string;
    grossAmount: string;
    netAmount: string;
    taxAmount: string;
    country: string;
  };
  fieldReviewStates?: Partial<Record<string, OcrFieldReviewStatus>>;
  special: {
    fuel: {
      liters: number | null;
      pricePerLiter: number | null;
      fuelType: string | null;
    } | null;
    hospitality: {
      location: string | null;
      subtotal: number | null;
      tip: number | null;
      lineItems: Array<{ label: string; amount: number | null }>;
    } | null;
    lodging: {
      location: string | null;
      nights: number | null;
      subtotal: number | null;
      tax: number | null;
      fees: number | null;
      lineItems: Array<{ label: string; amount: number | null }>;
    } | null;
    parking: {
      location: string | null;
      durationText: string | null;
      entryTime: string | null;
      exitTime: string | null;
    } | null;
    toll: {
      station: string | null;
      routeHint: string | null;
      vehicleClass: string | null;
    } | null;
    invoice: {
      lineItems: Array<{
        lineNumber: number | null;
        description: string;
        quantity: number | null;
        unit: string | null;
        unitPrice: number | null;
        totalPrice: number | null;
        taxHint: string | null;
        confidence: string;
        status: "confident" | "uncertain" | "partial";
      }>;
    } | null;
  };
  specialConfidence: {
    fuel: {
      liters: string;
      pricePerLiter: string;
      fuelType: string;
    } | null;
    hospitality: {
      location: string;
      subtotal: string;
      tip: string;
    } | null;
    lodging: {
      location: string;
      nights: string;
      subtotal: string;
      tax: string;
      fees: string;
      lineItems: string;
    } | null;
    parking: {
      location: string;
      durationText: string;
      entryTime: string;
      exitTime: string;
    } | null;
    toll: {
      station: string;
      routeHint: string;
      vehicleClass: string;
    } | null;
    invoice: {
      lineItems: string;
    } | null;
  };
};

function parseStructuredData(value: unknown): StructuredData | null {
  if (!value || typeof value !== "object") return null;
  return value as StructuredData;
}

function formatSuggestedValue(value: string, status: OcrFieldReviewStatus | undefined, confidence: string) {
  if (status) return `${value} (${fieldReviewStatusLabels[status]})`;
  if (confidence === "high") return `${value} (sicher)`;
  if (confidence === "medium") return `${value} (wahrscheinlich)`;
  if (confidence === "low") return `${value} (unsicher)`;
  return value;
}
