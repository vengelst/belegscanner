"use client";

import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SelectField } from "@/components/ui/select-field";
import type { OcrFieldKey } from "@/lib/receipts/field-review-states";

type CurrencyOption = { value: string; label: string };

type Props = {
  today: string;
  date: string;
  amount: string;
  invoiceNumber: string;
  netAmount: string;
  taxAmount: string;
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
  setAmount: (v: string) => void;
  setInvoiceNumber: (v: string) => void;
  setNetAmount: (v: string) => void;
  setTaxAmount: (v: string) => void;
  setCurrency: (v: string) => void;
  setSupplier: (v: string) => void;
  setExchangeRate: (v: string) => void;
  setExchangeRateDate: (v: string) => void;
};

export function ReceiptFormDataSection({
  today,
  date,
  amount,
  invoiceNumber,
  netAmount,
  taxAmount,
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
  setAmount,
  setInvoiceNumber,
  setNetAmount,
  setTaxAmount,
  setCurrency,
  setSupplier,
  setExchangeRate,
  setExchangeRateDate,
}: Props) {
  return (
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
        {requiresExchangeRate ? (
          <Input
            label="Rechnungsbetrag (EUR)"
            name="amountEurPreview"
            type="text"
            value={amountEurPreview}
            readOnly
          />
        ) : (
          <Input
            label="Rechnungsbetrag (EUR)"
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
          label="Rechnungsnummer"
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
            label={`Rechnungsbetrag (${normalizedCurrency})`}
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
            label="Nettobetrag"
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
          label="Steuerbetrag"
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
          label={requiresExchangeRate ? "Wechselkurs *" : "Wechselkurs (optional)"}
          name="exchangeRate"
          type="text"
          inputMode="decimal"
          placeholder="1 EUR = ?"
          required={requiresExchangeRate}
          value={exchangeRate}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => setExchangeRate(event.target.value)}
        />
        <Input
          label={requiresExchangeRate ? "Kursdatum *" : "Kursdatum (optional)"}
          name="exchangeRateDate"
          type="date"
          required={requiresExchangeRate}
          value={exchangeRateDate}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => setExchangeRateDate(event.target.value)}
        />
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
