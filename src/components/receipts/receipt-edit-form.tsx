"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type Purpose = { id: string; name: string; isHospitality: boolean };
type Category = { id: string; name: string };
type Country = { id: string; name: string; code: string | null; currencyCode: string | null };
type Vehicle = { id: string; plate: string; description: string | null };

type ReceiptData = {
  id: string;
  date: string;
  supplier: string | null;
  amount: number;
  currency: string;
  exchangeRate: number | null;
  exchangeRateDate: string | null;
  countryId: string | null;
  vehicleId: string | null;
  purposeId: string;
  categoryId: string;
  remark: string | null;
  hospitality: { occasion: string; guests: string; location: string } | null;
};

type Props = {
  receipt: ReceiptData;
  hasOriginalFile: boolean;
  purposes: Purpose[];
  categories: Category[];
  countries: Country[];
  vehicles: Vehicle[];
};

export function ReceiptEditForm({ receipt, hasOriginalFile, purposes, categories, countries, vehicles }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [purposeId, setPurposeId] = useState(receipt.purposeId);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedPurpose = purposes.find((p) => p.id === purposeId);
  const isHospitality = selectedPurpose?.isHospitality ?? false;

  function handleSubmit(formData: FormData) {
    setError(null);

    const amount = parseFloat((formData.get("amount") as string).replace(",", "."));
    const currency = (formData.get("currency") as string) || "EUR";

    let exchangeRate: number | null = null;
    const erVal = formData.get("exchangeRate") as string;
    if (erVal) exchangeRate = parseFloat(erVal.replace(",", "."));

    const body: Record<string, unknown> = {
      date: formData.get("date"),
      supplier: formData.get("supplier") || null,
      amount: isNaN(amount) ? 0 : amount,
      currency,
      exchangeRate,
      exchangeRateDate: formData.get("exchangeRateDate") || null,
      countryId: formData.get("countryId") || null,
      vehicleId: formData.get("vehicleId") || null,
      purposeId: formData.get("purposeId"),
      categoryId: formData.get("categoryId"),
      remark: formData.get("remark") || null,
    };

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
        setError(data.error ?? "Fehler beim Speichern.");
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
          <Input label="Belegdatum" name="date" type="date" required defaultValue={receipt.date} />
          <Input label="Betrag" name="amount" type="text" inputMode="decimal" required defaultValue={String(receipt.amount).replace(".", ",")} />
          <Input label="Waehrung" name="currency" type="text" maxLength={3} defaultValue={receipt.currency} />
          <Input label="Lieferant" name="supplier" defaultValue={receipt.supplier ?? ""} />
          <Input label="Wechselkurs" name="exchangeRate" type="text" inputMode="decimal" defaultValue={receipt.exchangeRate ? String(receipt.exchangeRate).replace(".", ",") : ""} />
          <Input label="Kursdatum" name="exchangeRateDate" type="date" defaultValue={receipt.exchangeRateDate ?? ""} />
        </div>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold tracking-tight">Originalbeleg</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {hasOriginalFile
            ? "Vorhandene Originaldatei kann bei Bedarf ersetzt werden."
            : "Diesem Beleg fehlt noch die Originaldatei. Sie kann hier nachgereicht werden."}
        </p>
        <div className="mt-4">
          <label className={`flex cursor-pointer flex-col items-center gap-3 rounded-2xl border-2 border-dashed p-6 transition hover:border-primary/40 hover:bg-primary/5 ${file || hasOriginalFile ? "border-border" : "border-accent/40"}`}>
            <span className="text-sm font-medium text-muted-foreground">
              {file ? file.name : hasOriginalFile ? "Datei fuer Ersatz auswaehlen" : "Originaldatei nachreichen"}
            </span>
            <input
              type="file"
              accept="image/jpeg,image/png,application/pdf"
              capture="environment"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="sr-only"
            />
            <span className="rounded-2xl border border-border bg-card px-4 py-2 text-sm font-semibold transition hover:border-primary/40 hover:text-primary">
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
          <SelectField label="Kategorie" name="categoryId" required defaultValue={receipt.categoryId}>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </SelectField>
          <SelectField label="Land" name="countryId" defaultValue={receipt.countryId ?? ""}>
            <option value="">-- optional --</option>
            {countries.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </SelectField>
          <SelectField label="Kfz" name="vehicleId" defaultValue={receipt.vehicleId ?? ""}>
            <option value="">-- optional --</option>
            {vehicles.map((v) => <option key={v.id} value={v.id}>{v.plate}</option>)}
          </SelectField>
          <label className="grid gap-1 text-sm font-medium sm:col-span-2">
            <span className="text-xs text-muted-foreground">Bemerkung</span>
            <textarea name="remark" rows={2} maxLength={2000} defaultValue={receipt.remark ?? ""} className="rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10" />
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
              <textarea name="guests" required rows={2} defaultValue={receipt.hospitality?.guests ?? ""} className="rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10" />
            </label>
            <Input label="Ort" name="location" required defaultValue={receipt.hospitality?.location ?? ""} />
          </div>
        </Card>
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
      <select name={name} required={required} value={value} defaultValue={!value ? defaultValue : undefined} onChange={onChange ? (e) => onChange(e.target.value) : undefined} className="h-12 rounded-2xl border border-border bg-background px-4 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10">
        {children}
      </select>
    </label>
  );
}
