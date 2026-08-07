"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { recalculateAmountsFromLineItemSum, splitGrossByVatRate, sumActiveLineItems } from "@/lib/receipts/form-helpers";
import { DuplicateWarning } from "@/components/receipts/duplicate-warning";
import {
  DATEV_BELEGTYP_FIELD_LABEL,
  DATEV_BELEGTYP_VALUES,
  datevBelegtypHints,
  suggestDatevBelegtyp,
  type DatevBelegtyp,
} from "@/lib/datev/belegtyp";
import { InvoiceLineItemEditor, SimpleLineItemEditor } from "@/components/receipts/line-item-editor";
import type { StructuredData } from "@/components/receipts/detail/parse-structured-data";
import { useDuplicateCheck } from "@/hooks/useDuplicateCheck";

type Purpose = { id: string; name: string; isHospitality: boolean };
type Country = { id: string; name: string; code: string | null; currencyCode: string | null; vatRatePercent: number | null };
type Vehicle = { id: string; plate: string; description: string | null };

type ReceiptData = {
  id: string;
  date: string;
  partyRole: "CREDITOR" | "DEBTOR";
  supplier: string | null;
  invoiceNumber: string | null;
  serviceDate: string | null;
  dueDate: string | null;
  amount: number;
  currency: string;
  netAmount: number | null;
  taxAmount: number | null;
  reverseCharge: boolean;
  vatRatePercent: number | null;
  exchangeRate: number | null;
  exchangeRateDate: string | null;
  countryId: string | null;
  vehicleId: string | null;
  purposeId: string;
  datevBelegtyp: DatevBelegtyp | null;
  /** Erkannte Belegart (GENERAL, HOSPITALITY, ...) fuer die Belegtyp-Vorbelegung. */
  aiDocumentType: string | null;
  remark: string | null;
  hospitality: { occasion: string; guests: string; location: string } | null;
};

type Props = {
  receipt: ReceiptData;
  structuredData: StructuredData | null;
  hasOriginalFile: boolean;
  purposes: Purpose[];
  countries: Country[];
  vehicles: Vehicle[];
  /** Endziffern der Firmenkarten aus den Organisationseinstellungen. */
  companyCardLastDigits: string[];
  /** Standard-Belegtyp aus den Organisationseinstellungen. */
  defaultDatevBelegtyp: DatevBelegtyp;
  /** Anzeigenamen der Belegtypen inkl. eigener Bezeichnungen. */
  datevBelegtypLabels: Record<DatevBelegtyp, string>;
};

export function ReceiptEditForm({
  receipt,
  structuredData,
  hasOriginalFile,
  purposes,
  countries,
  vehicles,
  companyCardLastDigits,
  defaultDatevBelegtyp,
  datevBelegtypLabels,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [purposeId, setPurposeId] = useState(receipt.purposeId);
  const [partyRole, setPartyRole] = useState<"CREDITOR" | "DEBTOR">(receipt.partyRole);
  // Belege ohne gespeicherten Belegtyp (Altbestand) bekommen einen Vorschlag aus
  // Belegrichtung und Erkennungsdaten, der bei Aenderung der Richtung mitwandert.
  const [datevBelegtyp, setDatevBelegtyp] = useState<DatevBelegtyp>(
    receipt.datevBelegtyp
      ?? suggestDatevBelegtyp({
        partyRole: receipt.partyRole,
        paymentMethod: structuredData?.extracted.paymentMethod ?? null,
        cardLastDigits: structuredData?.extracted.cardLastDigits ?? null,
        documentType: receipt.aiDocumentType,
        companyCardLastDigits,
      }, { defaultBelegtyp: defaultDatevBelegtyp }),
  );
  const [datevBelegtypManuallyChanged, setDatevBelegtypManuallyChanged] = useState(
    receipt.datevBelegtyp !== null,
  );
  const [countryId, setCountryId] = useState(receipt.countryId ?? "");
  const [currency, setCurrency] = useState(receipt.currency);
  const [amount, setAmount] = useState(String(receipt.amount).replace(".", ","));
  const [netAmount, setNetAmount] = useState(receipt.netAmount != null ? String(receipt.netAmount).replace(".", ",") : "");
  const [taxAmount, setTaxAmount] = useState(receipt.taxAmount != null ? String(receipt.taxAmount).replace(".", ",") : "");
  const [reverseCharge, setReverseCharge] = useState(receipt.reverseCharge);
  const [vatRatePercent, setVatRatePercent] = useState<number | null>(receipt.vatRatePercent);
  const [netManuallyOverridden, setNetManuallyOverridden] = useState(false);
  const [taxManuallyOverridden, setTaxManuallyOverridden] = useState(false);
  const skipInitialVatEffect = useRef(true);
  const [exchangeRate, setExchangeRate] = useState(receipt.exchangeRate ? formatLocalizedNumber(receipt.exchangeRate, 4) : "");
  const [exchangeRateDate, setExchangeRateDate] = useState(receipt.exchangeRateDate ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exchangeRateInfo, setExchangeRateInfo] = useState<string | null>(null);
  const [exchangeRateLoading, setExchangeRateLoading] = useState(false);
  const [date, setDate] = useState(receipt.date);
  const [supplier, setSupplier] = useState(receipt.supplier ?? "");
  const [invoiceNumber, setInvoiceNumber] = useState(receipt.invoiceNumber ?? "");
  const [lineItemData, setLineItemData] = useState<StructuredData | null>(structuredData);
  const [lineItemsDirty, setLineItemsDirty] = useState(false);
  const [lineItemNotice, setLineItemNotice] = useState<string | null>(null);

  const duplicateCheck = useDuplicateCheck();

  useEffect(() => {
    duplicateCheck.check({
      date,
      amount,
      supplier,
      invoiceNumber,
      excludeReceiptId: receipt.id,
    });
  }, [date, amount, supplier, invoiceNumber]); // eslint-disable-line react-hooks/exhaustive-deps

  const hasLineItems = Boolean(
    (lineItemData?.special.invoice?.lineItems.length ?? 0) > 0
      || (lineItemData?.special.hospitality?.lineItems.length ?? 0) > 0
      || (lineItemData?.special.lodging?.lineItems.length ?? 0) > 0,
  );

  const selectedPurpose = purposes.find((p) => p.id === purposeId);
  const isHospitality = selectedPurpose?.isHospitality ?? false;

  useEffect(() => {
    if (datevBelegtypManuallyChanged) return;
    setDatevBelegtyp(suggestDatevBelegtyp({
      partyRole,
      paymentMethod: structuredData?.extracted.paymentMethod ?? null,
      cardLastDigits: structuredData?.extracted.cardLastDigits ?? null,
      documentType: receipt.aiDocumentType,
      companyCardLastDigits,
    }, { defaultBelegtyp: defaultDatevBelegtyp }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partyRole, datevBelegtypManuallyChanged]);
  const requiresExchangeRate = currency.trim().toUpperCase() !== "EUR";
  const normalizedCurrency = currency.trim().toUpperCase() || "EUR";
  const currencyOptions = useMemo(() => buildCurrencyOptions(countries), [countries]);
  const amountEurPreview = useMemo(() => {
    const parsedAmount = parseLocalizedNumber(amount);
    const parsedRate = parseLocalizedNumber(exchangeRate);
    if (parsedAmount === null) return "";
    if (!requiresExchangeRate) return formatLocalizedNumber(parsedAmount);
    if (parsedRate === null || parsedRate <= 0) return "";
    return formatLocalizedNumber(parsedAmount / parsedRate);
  }, [amount, exchangeRate, requiresExchangeRate]);

  useEffect(() => {
    if (!requiresExchangeRate) {
      setExchangeRate("");
      setExchangeRateDate("");
      setExchangeRateInfo(null);
      setExchangeRateLoading(false);
      return;
    }

    let cancelled = false;
    setExchangeRateLoading(true);
    setExchangeRateInfo(null);

    fetch(`/api/exchange-rate?currency=${encodeURIComponent(currency.trim().toUpperCase())}`)
      .then(async (response) => {
        const data = await response.json().catch(() => null);
        if (!response.ok) {
          const message = data && typeof data === "object" && "error" in data ? String(data.error) : "Wechselkurs konnte nicht geladen werden.";
          throw new Error(message);
        }
        if (cancelled) return;
        const nextRate = typeof data.rate === "number" ? data.rate : null;
        const nextDate = typeof data.rateDate === "string" ? data.rateDate : "";
        if (nextRate !== null) setExchangeRate(formatLocalizedNumber(nextRate, 4));
        setExchangeRateDate(nextDate);
        setExchangeRateInfo(`Aktueller Wechselkurs fuer ${currency.trim().toUpperCase()} automatisch geladen.`);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : "Wechselkurs konnte nicht geladen werden.";
        setExchangeRateInfo(message);
      })
      .finally(() => {
        if (!cancelled) setExchangeRateLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [currency, requiresExchangeRate]);

  useEffect(() => {
    if (skipInitialVatEffect.current) {
      skipInitialVatEffect.current = false;
      return;
    }

    const parsedAmount = parseLocalizedNumber(amount);
    if (reverseCharge) {
      setVatRatePercent(null);
      setTaxAmount("0");
      if (parsedAmount !== null && !netManuallyOverridden) {
        setNetAmount(formatAmountInput(parsedAmount));
      }
      return;
    }

    const selectedCountry = countries.find((country) => country.id === countryId);
    const countryRate = selectedCountry?.vatRatePercent ?? null;
    if (countryRate == null) {
      setVatRatePercent(null);
      return;
    }
    if (parsedAmount === null) return;

    if (taxManuallyOverridden && netManuallyOverridden) {
      setVatRatePercent(countryRate);
      return;
    }

    const { net, tax } = splitGrossByVatRate(parsedAmount, countryRate);
    setVatRatePercent(countryRate);
    if (!netManuallyOverridden) setNetAmount(formatAmountInput(net));
    if (!taxManuallyOverridden) setTaxAmount(formatAmountInput(tax));
  }, [amount, countryId, countries, reverseCharge, netManuallyOverridden, taxManuallyOverridden]);

  /** Uebernimmt die Summe der aktiven Positionen inkl. Netto/MwSt aus Beleg oder Land. */
  function applyGrossFromLineItems(
    summary: { activeCount: number; totalCount: number; activeSum: number | null },
    allItemsSum: number | null,
  ) {
    setLineItemsDirty(true);

    if (summary.activeCount === 0) {
      setAmount(formatAmountInput(0));
      setNetAmount(formatAmountInput(0));
      setTaxAmount(formatAmountInput(0));
      setVatRatePercent(null);
      setNetManuallyOverridden(true);
      setTaxManuallyOverridden(true);
      setLineItemNotice("Alle Positionen sind deaktiviert. Betrag, Netto und Steuer stehen auf 0,00 - der Beleg kann so nicht gespeichert werden.");
      return;
    }

    if (summary.activeSum === null) {
      setLineItemNotice("Keine der aktiven Positionen hat einen Betrag. Der Rechnungsbetrag wurde nicht veraendert und muss manuell geprueft werden.");
      return;
    }

    const selectedCountry = countries.find((country) => country.id === countryId);
    const receiptRate = receipt.vatRatePercent
      ?? (
        receipt.netAmount != null && receipt.netAmount > 0 && receipt.taxAmount != null
          ? Math.round((receipt.taxAmount / receipt.netAmount) * 10000) / 100
          : null
      );
    const recalc = recalculateAmountsFromLineItemSum({
      activeSum: summary.activeSum,
      allItemsSum,
      reverseCharge,
      countryVatRatePercent: receiptRate ?? selectedCountry?.vatRatePercent ?? null,
      receipt: {
        // Volle Positionssumme als Beleg-Brutto-Proxy, Netto/Steuer aus gespeichertem Satz.
        gross: allItemsSum,
        net: receiptRate != null && allItemsSum != null
          ? Math.round((allItemsSum / (1 + receiptRate / 100)) * 100) / 100
          : null,
        tax: receiptRate != null && allItemsSum != null
          ? Math.round((allItemsSum - allItemsSum / (1 + receiptRate / 100)) * 100) / 100
          : null,
      },
    });

    setAmount(formatAmountInput(recalc.amount));
    setNetAmount(formatAmountInput(recalc.net));
    setTaxAmount(formatAmountInput(recalc.tax));
    setVatRatePercent(reverseCharge ? null : recalc.vatRatePercent);
    setNetManuallyOverridden(true);
    setTaxManuallyOverridden(true);
    const basisHint = recalc.lineItemsAreNet ? "Positionen als Netto erkannt" : "MwSt aus Beleg/Land";
    setLineItemNotice(
      `Betrag, Netto und Steuer aus ${summary.activeCount} von ${summary.totalCount} Positionen neu berechnet (${basisHint}).`,
    );
  }

  function toggleInvoiceLineItem(index: number) {
    const invoice = lineItemData?.special.invoice;
    if (!lineItemData || !invoice) return;

    const lineItems = invoice.lineItems.map((item, itemIndex) => (
      itemIndex === index ? { ...item, excluded: !(item.excluded ?? false) } : item
    ));

    setLineItemData({ ...lineItemData, special: { ...lineItemData.special, invoice: { ...invoice, lineItems } } });
    const active = sumActiveLineItems(lineItems, (item) => item.totalPrice);
    const all = sumActiveLineItems(
      lineItems.map((item) => ({ ...item, excluded: false })),
      (item) => item.totalPrice,
    );
    applyGrossFromLineItems(active, all.activeSum);
  }

  function toggleHospitalityLineItem(index: number) {
    const hospitality = lineItemData?.special.hospitality;
    if (!lineItemData || !hospitality) return;

    const lineItems = hospitality.lineItems.map((item, itemIndex) => (
      itemIndex === index ? { ...item, excluded: !(item.excluded ?? false) } : item
    ));

    setLineItemData({ ...lineItemData, special: { ...lineItemData.special, hospitality: { ...hospitality, lineItems } } });
    const active = sumActiveLineItems(lineItems, (item) => item.amount);
    const all = sumActiveLineItems(
      lineItems.map((item) => ({ ...item, excluded: false })),
      (item) => item.amount,
    );
    applyGrossFromLineItems(active, all.activeSum);
  }

  function toggleLodgingLineItem(index: number) {
    const lodging = lineItemData?.special.lodging;
    if (!lineItemData || !lodging) return;

    const lineItems = lodging.lineItems.map((item, itemIndex) => (
      itemIndex === index ? { ...item, excluded: !(item.excluded ?? false) } : item
    ));

    setLineItemData({ ...lineItemData, special: { ...lineItemData.special, lodging: { ...lodging, lineItems } } });
    const active = sumActiveLineItems(lineItems, (item) => item.amount);
    const all = sumActiveLineItems(
      lineItems.map((item) => ({ ...item, excluded: false })),
      (item) => item.amount,
    );
    applyGrossFromLineItems(active, all.activeSum);
  }

  function handleSubmit(formData: FormData) {
    setError(null);

    if (duplicateCheck.hasDuplicates) {
      setError("Bitte pruefen Sie den moeglichen Duplikat-Beleg und bestaetigen Sie mit 'Trotzdem speichern'.");
      return;
    }

    const amountValue = parseFloat((formData.get("amount") as string).replace(",", "."));
    const currencyValue = (formData.get("currency") as string) || "EUR";

    let parsedExchangeRate: number | null = null;
    const erVal = (formData.get("exchangeRate") as string) || exchangeRate;
    if (erVal) parsedExchangeRate = parseFloat(erVal.replace(",", "."));

    const parsedNet = netAmount ? parseFloat(netAmount.replace(",", ".")) : null;
    let parsedTax = taxAmount ? parseFloat(taxAmount.replace(",", ".")) : null;
    if (reverseCharge) parsedTax = 0;

    const body: Record<string, unknown> = {
      date: formData.get("date"),
      partyRole: formData.get("partyRole") || partyRole || "CREDITOR",
      supplier: formData.get("supplier") || null,
      invoiceNumber: formData.get("invoiceNumber") || null,
      serviceDate: receipt.serviceDate,
      dueDate: receipt.dueDate,
      amount: isNaN(amountValue) ? 0 : amountValue,
      currency: currencyValue,
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
    };

    // Positions-Flags nur mitschicken, wenn sie in diesem Formular geaendert wurden.
    if (lineItemsDirty && lineItemData) body.aiStructuredData = lineItemData;

    if (isHospitality) {
      body.hospitality = {
        occasion: formData.get("occasion") || "",
        guests: formData.get("guests") || "",
        location: formData.get("location") || "",
      };
    } else {
      body.hospitality = null;
    }

    startTransition(async () => {
      const res = await fetch(`/api/receipts/${receipt.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(getApiErrorMessage(data, "Fehler beim Speichern."));
        return;
      }

      if (file) {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("receiptId", receipt.id);
        const uploadRes = await fetch("/api/files/upload", { method: "POST", body: fd });
        if (!uploadRes.ok) {
          const data = await uploadRes.json();
          setError(`Aenderungen gespeichert, aber Datei-Upload fehlgeschlagen: ${data.error}`);
          router.refresh();
          return;
        }
      }

      router.push(`/receipts/${receipt.id}`);
      router.refresh();
    });
  }

  return (
    <form action={handleSubmit} className="space-y-6">
      <Card>
        <h2 className="text-lg font-semibold tracking-tight">Belegdaten</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Input label="Belegdatum" name="date" type="date" required value={date} onChange={(event: React.ChangeEvent<HTMLInputElement>) => setDate(event.target.value)} />
          <SelectField label="Belegrichtung" name="partyRole" value={partyRole} onChange={(v) => setPartyRole(v as "CREDITOR" | "DEBTOR")}>
            <option value="CREDITOR">Kreditor (Eingangsbeleg)</option>
            <option value="DEBTOR">Debitor (Ausgangsbeleg)</option>
          </SelectField>
          {requiresExchangeRate ? (
            <Input label="Rechnungsbetrag (EUR)" name="amountEurPreview" type="text" value={amountEurPreview} readOnly />
          ) : (
            <Input
              label="Rechnungsbetrag (EUR)"
              name="amount"
              type="text"
              inputMode="decimal"
              required
              value={amount}
              onChange={(event: React.ChangeEvent<HTMLInputElement>) => setAmount(event.target.value)}
            />
          )}
          <Input label="Rechnungsnummer" name="invoiceNumber" maxLength={80} value={invoiceNumber} onChange={(event: React.ChangeEvent<HTMLInputElement>) => setInvoiceNumber(event.target.value)} />
          {requiresExchangeRate ? (
            <Input
              label={`Rechnungsbetrag (${normalizedCurrency})`}
              name="amount"
              type="text"
              inputMode="decimal"
              required
              value={amount}
              onChange={(event: React.ChangeEvent<HTMLInputElement>) => setAmount(event.target.value)}
            />
          ) : (
            <Input
              label="Nettobetrag"
              name="netAmount"
              type="text"
              inputMode="decimal"
              value={netAmount}
              onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                setNetManuallyOverridden(true);
                setNetAmount(event.target.value);
              }}
            />
          )}
          <Input
            label="Steuerbetrag"
            name="taxAmount"
            type="text"
            inputMode="decimal"
            value={taxAmount}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
              setTaxManuallyOverridden(true);
              setTaxAmount(event.target.value);
            }}
          />
          <SelectField label="Waehrung" name="currency" value={currency} onChange={setCurrency}>
            {currencyOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </SelectField>
          <Input
            label={partyRole === "DEBTOR" ? "Kunde / Debitor" : "Lieferant / Kreditor"}
            name="supplier"
            value={supplier}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) => setSupplier(event.target.value)}
          />
          <Input
            label={requiresExchangeRate ? "Wechselkurs *" : "Wechselkurs (optional)"}
            name="exchangeRate"
            type="text"
            inputMode="decimal"
            value={exchangeRate}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) => setExchangeRate(event.target.value)}
            required={requiresExchangeRate}
          />
          <Input
            label={requiresExchangeRate ? "Kursdatum *" : "Kursdatum (optional)"}
            name="exchangeRateDate"
            type="date"
            value={exchangeRateDate}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) => setExchangeRateDate(event.target.value)}
            required={requiresExchangeRate}
          />
          <label className="flex items-start gap-2 text-sm font-medium sm:col-span-2 lg:col-span-3">
            <input
              type="checkbox"
              name="reverseCharge"
              checked={reverseCharge}
              onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                setTaxManuallyOverridden(false);
                setReverseCharge(event.target.checked);
              }}
              className="bb-checkbox-3d"
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
            <p>Fuer Fremdwaehrungsbelege wird der aktuelle Wechselkurs automatisch geladen und beim Speichern verwendet.</p>
            {exchangeRateLoading ? <p>Wechselkurs wird geladen...</p> : null}
            {exchangeRateInfo ? <p>{exchangeRateInfo}</p> : null}
          </div>
        ) : null}
      </Card>

      {hasLineItems ? (
        <Card>
          <h2 className="text-lg font-semibold tracking-tight">Positionen</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Positionen, die nicht zur Firma gehoeren, koennen deaktiviert werden. Rechnungsbetrag, Netto und
            Steuer werden aus den aktiven Positionen neu berechnet.
          </p>
          <InvoiceLineItemEditor
            items={lineItemData?.special.invoice?.lineItems ?? []}
            currency={currency}
            title="Rechnungspositionen"
            onToggleExcluded={toggleInvoiceLineItem}
          />
          <SimpleLineItemEditor
            items={lineItemData?.special.hospitality?.lineItems ?? []}
            title="Bewirtungspositionen"
            currency={currency}
            onToggleExcluded={toggleHospitalityLineItem}
          />
          <SimpleLineItemEditor
            items={lineItemData?.special.lodging?.lineItems ?? []}
            title="Unterkunft-Zusatzpositionen"
            currency={currency}
            onToggleExcluded={toggleLodgingLineItem}
          />
          {lineItemNotice ? (
            <p className="mt-3 text-xs font-medium text-accent-foreground">{lineItemNotice}</p>
          ) : null}
        </Card>
      ) : null}

      <Card>
        <h2 className="text-lg font-semibold tracking-tight">Originalbeleg</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {hasOriginalFile
            ? "Vorhandene Originaldatei kann bei Bedarf ersetzt werden."
            : "Diesem Beleg fehlt noch die Originaldatei. Sie kann hier nachgereicht werden."}
        </p>
        <div className="mt-4">
          <label className={`flex cursor-pointer items-center justify-between gap-3 rounded-2xl border-2 border-dashed px-4 py-2.5 transition hover:border-primary/40 hover:bg-primary/5 ${file || hasOriginalFile ? "border-border" : "border-accent/40"}`}>
            <span className="min-w-0 truncate text-sm font-medium text-muted-foreground">
              {file ? file.name : hasOriginalFile ? "Datei fuer Ersatz auswaehlen" : "Originaldatei nachreichen"}
            </span>
            <input
              type="file"
              accept="image/jpeg,image/png,application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="sr-only"
            />
            <span className="bb-chip-button shrink-0 rounded-2xl px-4 py-2 text-sm">
              Datei auswaehlen
            </span>
          </label>
        </div>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold tracking-tight">Zuordnung</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <SelectField label="Zweck" name="purposeId" required value={purposeId} onChange={setPurposeId}>
            {purposes.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </SelectField>
          <SelectField label="Land" name="countryId" value={countryId} onChange={(value) => {
            setTaxManuallyOverridden(false);
            setNetManuallyOverridden(false);
            setCountryId(value);
          }}>
            <option value="">-- optional --</option>
            {countries.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </SelectField>
          <SelectField label="Kfz" name="vehicleId" defaultValue={receipt.vehicleId ?? ""}>
            <option value="">-- optional --</option>
            {vehicles.map((v) => <option key={v.id} value={v.id}>{v.plate}</option>)}
          </SelectField>
          <div className="grid gap-1">
            <SelectField
              label={DATEV_BELEGTYP_FIELD_LABEL}
              name="datevBelegtyp"
              required
              value={datevBelegtyp}
              onChange={(value) => {
                setDatevBelegtypManuallyChanged(true);
                setDatevBelegtyp(value as DatevBelegtyp);
              }}
            >
              {DATEV_BELEGTYP_VALUES.map((belegtyp) => (
                <option key={belegtyp} value={belegtyp}>
                  {datevBelegtypLabels[belegtyp]} ({datevBelegtypHints[belegtyp]})
                </option>
              ))}
            </SelectField>
            <p className="text-xs text-muted-foreground">
              Bestimmt, an welche DATEV-Upload-Adresse der Beleg versendet wird.
            </p>
          </div>
          <label className="grid gap-1 text-sm font-medium sm:col-span-2">
            <span className="text-xs text-muted-foreground">Bemerkung</span>
            <textarea name="remark" rows={2} maxLength={2000} defaultValue={receipt.remark ?? ""} className="bb-input bb-textarea input-3d rounded-xl px-3 py-2.5 text-sm outline-none transition-all duration-200 focus:ring-2 focus:ring-primary/20" />
          </label>
        </div>
      </Card>

      {isHospitality ? (
        <Card>
          <h2 className="text-lg font-semibold tracking-tight">Bewirtungsangaben</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Input label="Anlass" name="occasion" required defaultValue={receipt.hospitality?.occasion ?? ""} />
            <label className="grid gap-1 text-sm font-medium">
              <span className="text-xs text-muted-foreground">Gaeste</span>
              <textarea name="guests" required rows={2} defaultValue={receipt.hospitality?.guests ?? ""} className="bb-input bb-textarea input-3d rounded-xl px-3 py-2.5 text-sm outline-none transition-all duration-200 focus:ring-2 focus:ring-primary/20" />
            </label>
            <Input label="Ort" name="location" required defaultValue={receipt.hospitality?.location ?? ""} />
          </div>
        </Card>
      ) : null}

      {duplicateCheck.hasDuplicates ? (
        <DuplicateWarning
          candidates={duplicateCheck.candidates}
          onDismiss={duplicateCheck.dismiss}
        />
      ) : null}

      {error ? <p className="text-sm font-medium text-danger">{error}</p> : null}
      <button type="submit" disabled={isPending} className="rounded-2xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50">
        {isPending ? "Wird gespeichert..." : "Aenderungen speichern"}
      </button>
    </form>
  );
}

function SelectField({ label, name, required, value, onChange, defaultValue, children }: {
  label: string; name: string; required?: boolean; value?: string; onChange?: (v: string) => void; defaultValue?: string; children: React.ReactNode;
}) {
  return (
    <label className="grid gap-1 text-sm font-medium">
      <span className="text-xs text-muted-foreground">{label}</span>
      <select name={name} required={required} value={value} defaultValue={!value ? defaultValue : undefined} onChange={onChange ? (e) => onChange(e.target.value) : undefined} className="bb-select input-3d h-10 rounded-xl px-3 text-sm outline-none transition-all duration-200 focus:ring-2 focus:ring-primary/20">
        {children}
      </select>
    </label>
  );
}

function getApiErrorMessage(data: unknown, fallback: string): string {
  if (!data || typeof data !== "object") return fallback;

  const error = "error" in data && typeof data.error === "string" ? data.error : fallback;
  const details = "details" in data && data.details && typeof data.details === "object"
    ? Object.values(data.details as Record<string, unknown>)
        .flatMap((value) => Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [])
    : [];

  if (details.length === 0) return error;
  return `${error} ${details.join(" ")}`.trim();
}

function formatAmountInput(value: number): string {
  return value.toFixed(2).replace(".", ",");
}

function parseLocalizedNumber(value: string): number | null {
  const normalized = value.trim().replace(",", ".");
  if (!normalized) return null;
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatLocalizedNumber(value: number, maximumFractionDigits = 2): string {
  return value.toLocaleString("de-DE", {
    minimumFractionDigits: 2,
    maximumFractionDigits,
  });
}

function buildCurrencyOptions(countries: Country[]) {
  const unique = new Set<string>();

  for (const country of countries) {
    if (country.currencyCode?.trim()) unique.add(country.currencyCode.trim().toUpperCase());
  }

  return Array.from(unique)
    .sort((a, b) => (a === "EUR" ? -1 : b === "EUR" ? 1 : a.localeCompare(b)))
    .map((code) => ({ value: code, label: code }));
}
