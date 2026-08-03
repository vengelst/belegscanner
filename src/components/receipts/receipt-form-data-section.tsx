"use client";

import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SelectField } from "@/components/ui/select-field";
import type { OcrFieldKey } from "@/lib/receipts/field-review-states";

type CurrencyOption = { value: string; label: string };

type PartyRole = "CREDITOR" | "DEBTOR";

type Props = {
  today: string;
  date: string;
  partyRole: PartyRole;
  amount: string;
  invoiceNumber: string;
  netAmount: string;
  taxAmount: string;
  reverseCharge: boolean;
  currency: string;
  supplier: string;
  exchangeRate: string;
  exchangeRateDate: string;
  exchangeRateLoading: boolean;
  exchangeRateInfo: string | null;
  requiresExchangeRate: boolean;
  normalizedCurrency: string;
  amountEurPreview: string;
  currencyOptions: CurrencyOption[];
  markManualOverride: (field: OcrFieldKey) => void;
  setDate: (v: string) => void;
  setPartyRole: (v: PartyRole) => void;
  setAmount: (v: string) => void;
  setInvoiceNumber: (v: string) => void;
  setNetAmount: (v: string) => void;
  setTaxAmount: (v: string) => void;
  setReverseCharge: (v: boolean) => void;
  setCurrency: (v: string) => void;
  setSupplier: (v: string) => void;
  setExchangeRate: (v: string) => void;
  setExchangeRateDate: (v: string) => void;
};

export function ReceiptFormDataSection({
  today,
  date,
  partyRole,
  amount,
  invoiceNumber,
  netAmount,
  taxAmount,
  reverseCharge,
  currency,
  supplier,
  exchangeRate,
  exchangeRateDate,
  exchangeRateLoading,
  exchangeRateInfo,
  requiresExchangeRate,
  normalizedCurrency,
  amountEurPreview,
  currencyOptions,
  markManualOverride,
  setDate,
  setPartyRole,
  setAmount,
  setInvoiceNumber,
  setNetAmount,
  setTaxAmount,
  setReverseCharge,
  setCurrency,
  setSupplier,
  setExchangeRate,
  setExchangeRateDate,
}: Props) {
  const supplierLabel = partyRole === "DEBTOR" ? "Kunde / Debitor" : "Lieferant / Kreditor";

  return (
    <Card>
      <h2 className="text-base font-semibold tracking-tight">Belegdaten</h2>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-3">
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
        <SelectField
          label="Belegrichtung"
          name="partyRole"
          value={partyRole}
          onChange={(value) => setPartyRole(value as PartyRole)}
        >
          <option value="CREDITOR">Kreditor (Eingangsbeleg)</option>
          <option value="DEBTOR">Debitor (Ausgangsbeleg)</option>
        </SelectField>
        {requiresExchangeRate ? (
          <Input
            label="Betrag (EUR)"
            name="amountEurPreview"
            type="text"
            value={amountEurPreview}
            readOnly
          />
        ) : (
          <Input
            label="Betrag (EUR)"
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
        )}
        <Input
          label="Rechnungsnr."
          name="invoiceNumber"
          placeholder="optional"
          value={invoiceNumber}
          maxLength={80}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
            markManualOverride("invoiceNumber");
            setInvoiceNumber(event.target.value);
          }}
        />
        {requiresExchangeRate ? (
          <Input
            label={`Betrag (${normalizedCurrency})`}
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
        ) : (
          <Input
            label="Netto"
            name="netAmount"
            type="text"
            inputMode="decimal"
            placeholder="optional"
            value={netAmount}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
              markManualOverride("netAmount");
              setNetAmount(event.target.value);
            }}
          />
        )}
        <Input
          label="Steuer"
          name="taxAmount"
          type="text"
          inputMode="decimal"
          placeholder="optional"
          value={taxAmount}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
            markManualOverride("taxAmount");
            setTaxAmount(event.target.value);
          }}
        />
        <SelectField
          label="Waehrung"
          name="currency"
          value={currency}
          onChange={(value) => {
            markManualOverride("currency");
            setCurrency(value);
          }}
        >
          {currencyOptions.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </SelectField>
        <div className="col-span-2 lg:col-span-1">
          <Input
            label={supplierLabel}
            name="supplier"
            placeholder="optional"
            value={supplier}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
              markManualOverride("supplier");
              setSupplier(event.target.value);
            }}
          />
        </div>
        <Input
          label={requiresExchangeRate ? "Wechselkurs *" : "Wechselkurs"}
          name="exchangeRate"
          type="text"
          inputMode="decimal"
          placeholder="1 EUR = ?"
          required={requiresExchangeRate}
          value={exchangeRate}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => setExchangeRate(event.target.value)}
        />
        <Input
          label={requiresExchangeRate ? "Kursdatum *" : "Kursdatum"}
          name="exchangeRateDate"
          type="date"
          required={requiresExchangeRate}
          value={exchangeRateDate}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => setExchangeRateDate(event.target.value)}
        />
        <label className="col-span-2 flex items-start gap-2 text-sm font-medium lg:col-span-3">
          <input
            type="checkbox"
            name="reverseCharge"
            checked={reverseCharge}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) => setReverseCharge(event.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-border accent-primary"
          />
          <span>
            <span className="block">Reverse Charge</span>
            {reverseCharge ? (
              <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                Steuerschuldnerschaft des Leistungsempfaengers
              </span>
            ) : null}
          </span>
        </label>
      </div>
      {requiresExchangeRate ? (
        <div className="mt-3 space-y-1 text-sm text-muted-foreground">
          <p>
            Fuer Fremdwaehrungsbelege wird der aktuelle Wechselkurs automatisch geladen und beim Speichern verwendet.
          </p>
          {exchangeRateLoading ? <p>Wechselkurs wird geladen...</p> : null}
          {exchangeRateInfo ? <p>{exchangeRateInfo}</p> : null}
        </div>
      ) : null}
    </Card>
  );
}
