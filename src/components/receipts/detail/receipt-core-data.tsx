import { Card } from "@/components/ui/card";
import { Field } from "./field";

type ReceiptCoreDataProps = {
  date: string;
  invoiceNumber: string | null;
  currency: string;
  amount: string;
  netAmount: string | null;
  taxAmount: string | null;
  amountEur: string;
  exchangeRate: string | null;
  exchangeRateDate: string | null;
  supplier: string | null;
  purposeName: string;
  categoryName: string;
  countryDisplay: string;
  vehiclePlate: string | null;
  detectedPaymentMethod: string | null;
  detectedCardLastDigits: string | null;
  remark: string | null;
};

export function ReceiptCoreData({
  date,
  invoiceNumber,
  currency,
  amount,
  netAmount,
  taxAmount,
  amountEur,
  exchangeRate,
  exchangeRateDate,
  supplier,
  purposeName,
  categoryName,
  countryDisplay,
  vehiclePlate,
  detectedPaymentMethod,
  detectedCardLastDigits,
  remark,
}: ReceiptCoreDataProps) {
  return (
    <Card>
      <h2 className="text-lg font-semibold tracking-tight">Belegdaten</h2>
      <div className="mt-4 grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Belegdatum" value={date} />
        {invoiceNumber ? <Field label="Rechnungsnummer" value={invoiceNumber} /> : null}
        {currency !== "EUR" ? (
          <Field label={`Rechnungsbetrag (${currency})`} value={`${amount} ${currency}`} />
        ) : null}
        {netAmount ? <Field label="Nettobetrag" value={`${netAmount} ${currency}`} /> : null}
        {taxAmount ? <Field label="Steuerbetrag" value={`${taxAmount} ${currency}`} /> : null}
        <Field label="Rechnungsbetrag (EUR)" value={`${amountEur} EUR`} />
        {currency !== "EUR" ? (
          <>
            <Field label="Wechselkurs" value={exchangeRate ? `1 EUR = ${exchangeRate} ${currency}` : "—"} />
            <Field label="Kursdatum" value={exchangeRateDate ?? "—"} />
          </>
        ) : null}
        <Field label="Lieferant" value={supplier ?? "—"} />
        <Field label="Zweck" value={purposeName} />
        <Field label="Kategorie" value={categoryName} />
        <Field label="Land" value={countryDisplay} />
        <Field label="Kfz" value={vehiclePlate ?? "—"} />
        {detectedPaymentMethod ? <Field label="Zahlungsart" value={detectedPaymentMethod} /> : null}
        {detectedCardLastDigits ? <Field label="Kartenendziffern" value={detectedCardLastDigits} /> : null}
        {remark ? (
          <div className="sm:col-span-2 lg:col-span-3">
            <Field label="Bemerkung" value={remark} />
          </div>
        ) : null}
      </div>
    </Card>
  );
}
