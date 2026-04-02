"use client";

import { useState, useTransition } from "react";
import { Card } from "@/components/ui/card";

type Option = {
  id: string;
  label: string;
};

type Props = {
  initialDefaults: {
    defaultCountryId: string | null;
    defaultVehicleId: string | null;
    defaultPurposeId: string | null;
    defaultCategoryId: string | null;
  };
  countries: Option[];
  vehicles: Option[];
  purposes: Option[];
  categories: Option[];
};

export function UserReceiptDefaultsForm({
  initialDefaults,
  countries,
  vehicles,
  purposes,
  categories,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [defaultCountryId, setDefaultCountryId] = useState(initialDefaults.defaultCountryId ?? "");
  const [defaultVehicleId, setDefaultVehicleId] = useState(initialDefaults.defaultVehicleId ?? "");
  const [defaultPurposeId, setDefaultPurposeId] = useState(initialDefaults.defaultPurposeId ?? "");
  const [defaultCategoryId, setDefaultCategoryId] = useState(initialDefaults.defaultCategoryId ?? "");

  function handleSubmit() {
    setSuccess(null);
    setError(null);

    startTransition(async () => {
      const response = await fetch("/api/users/me/defaults", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          defaultCountryId: defaultCountryId || null,
          defaultVehicleId: defaultVehicleId || null,
          defaultPurposeId: defaultPurposeId || null,
          defaultCategoryId: defaultCategoryId || null,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Standardwerte konnten nicht gespeichert werden.");
        return;
      }

      setSuccess(data.message ?? "Standardwerte wurden gespeichert.");
    });
  }

  return (
    <Card>
      <h2 className="text-xl font-semibold tracking-tight">Standards fuer neue Belege</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Diese Werte werden fuer neue Belege vorbelegt, wenn keine letzten Werte aus einer Folgeerfassung vorliegen.
      </p>
      <form action={handleSubmit} className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SelectField label="Standard-Zweck" value={defaultPurposeId} onChange={setDefaultPurposeId} options={purposes} />
        <SelectField label="Standard-Kategorie" value={defaultCategoryId} onChange={setDefaultCategoryId} options={categories} />
        <SelectField label="Standard-Land" value={defaultCountryId} onChange={setDefaultCountryId} options={countries} />
        <SelectField label="Standard-Kfz" value={defaultVehicleId} onChange={setDefaultVehicleId} options={vehicles} />
        <div className="sm:col-span-2 lg:col-span-4 flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={isPending}
            className="rounded-2xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isPending ? "Wird gespeichert..." : "Standardwerte speichern"}
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={() => {
              setDefaultCountryId("");
              setDefaultVehicleId("");
              setDefaultPurposeId("");
              setDefaultCategoryId("");
              setSuccess(null);
              setError(null);
            }}
            className="rounded-2xl border border-border bg-card px-6 py-3 text-sm font-semibold transition hover:border-primary/40 hover:text-primary disabled:opacity-70"
          >
            Auswahl leeren
          </button>
        </div>
        {error ? <p className="text-sm font-medium text-danger sm:col-span-2 lg:col-span-4">{error}</p> : null}
        {success ? <p className="text-sm font-medium text-primary sm:col-span-2 lg:col-span-4">{success}</p> : null}
      </form>
    </Card>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Option[];
}) {
  return (
    <label className="grid gap-1 text-sm font-medium">
      <span className="text-xs text-muted-foreground">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-12 rounded-2xl border border-border bg-background px-4 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
      >
        <option value="">-- kein Standard --</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}
