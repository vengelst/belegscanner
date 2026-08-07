import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Field } from "./field";

type ReceiptCoreDataProps = {
  date: string;
  partyRole: "CREDITOR" | "DEBTOR";
  invoiceNumber: string | null;
  currency: string;
  amount: string;
  netAmount: string | null;
  taxAmount: string | null;
  reverseCharge: boolean;
  vatRatePercent: number | null;
  amountEur: string;
  exchangeRate: string | null;
  exchangeRateDate: string | null;
  supplier: string | null;
  purposeName: string;
  categoryName: string;
  countryDisplay: string;
  vehiclePlate: string | null;
  datevBelegtypLabel: string | null;
  detectedPaymentMethod: string | null;
  detectedCardLastDigits: string | null;
  remark: string | null;
};

export function ReceiptCoreData({
  date,
  partyRole,
  invoiceNumber,
  currency,
  amount,
  netAmount,
  taxAmount,
  reverseCharge,
  vatRatePercent,
  amountEur,
  exchangeRate,
  exchangeRateDate,
  supplier,
  purposeName,
  categoryName,
  countryDisplay,
  vehiclePlate,
  datevBelegtypLabel,
  detectedPaymentMethod,
  detectedCardLastDigits,
  remark,
}: ReceiptCoreDataProps) {
  const supplierLabel = partyRole === "DEBTOR" ? "Kunde / Debitor" : "Lieferant / Kreditor";
  const partyRoleLabel = partyRole === "DEBTOR" ? "Debitor (Ausgangsbeleg)" : "Kreditor (Eingangsbeleg)";

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold tracking-tight">Belegdaten</h2>
        {reverseCharge ? <Badge variant="warning">Reverse Charge</Badge> : null}
      </div>
      {reverseCharge ? (
        <p className="mt-2 text-sm text-muted-foreground">
          Steuerschuldnerschaft des Leistungsempfaengers
        </p>
      ) : null}
      <div className="mt-4 grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Belegdatum" value={date} />
        <Field label="Belegrichtung" value={partyRoleLabel} />
        {invoiceNumber ? <Field label="Rechnungsnummer" value={invoiceNumber} /> : null}
        {currency !== "EUR" ? (
          <Field label={`Rechnungsbetrag (${currency})`} value={`${amount} ${currency}`} />
        ) : null}
        {netAmount ? <Field label="Nettobetrag" value={`${netAmount} ${currency}`} /> : null}
        {taxAmount != null ? <Field label="Steuerbetrag" value={`${taxAmount} ${currency}`} /> : null}
        {!reverseCharge && vatRatePercent != null ? (
          <Field label="USt-Satz" value={`${vatRatePercent} %`} />
        ) : null}
        <Field label="Rechnungsbetrag (EUR)" value={`${amountEur} EUR`} />
        {currency !== "EUR" ? (
          <>
            <Field label="Wechselkurs" value={exchangeRate ? `1 EUR = ${exchangeRate} ${currency}` : "—"} />
            <Field label="Kursdatum" value={exchangeRateDate ?? "—"} />
          </>
        ) : null}
        <Field label={supplierLabel} value={supplier ?? "—"} />
        <Field label="Zweck" value={purposeName} />
        <Field label="Kategorie" value={categoryName} />
        <Field label="Land" value={countryDisplay} />
        <Field label="Kfz" value={vehiclePlate ?? "—"} />
        <Field label="DATEV-Belegtyp" value={datevBelegtypLabel ?? "— (fehlt, Versand nicht moeglich)"} />
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
