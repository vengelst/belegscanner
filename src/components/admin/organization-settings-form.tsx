"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export type OrganizationInitial = {
  legalName: string;
  tradeName: string;
  vatId: string;
  street: string;
  zip: string;
  city: string;
  countryCode: string;
  updatedAt: string | null;
};

export function OrganizationSettingsForm({ initial }: { initial: OrganizationInitial }) {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleSave(formData: FormData) {
    setError(null);
    setSuccess(null);

    startTransition(async () => {
      const res = await fetch("/api/admin/organization", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          legalName: formData.get("legalName"),
          tradeName: (formData.get("tradeName") as string) || null,
          vatId: (formData.get("vatId") as string) || null,
          street: (formData.get("street") as string) || null,
          zip: (formData.get("zip") as string) || null,
          city: (formData.get("city") as string) || null,
          countryCode: (formData.get("countryCode") as string) || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Fehler beim Speichern.");
        return;
      }
      setSuccess("Firmenstammdaten wurden gespeichert.");
      router.refresh();
    });
  }

  return (
    <Card>
      <h2 className="text-lg font-semibold tracking-tight">Firmenidentitaet</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Diese Daten werden der KI uebergeben, um Debitoren- und Kreditorenrechnungen zu unterscheiden.
        Ohne Firmenname bleibt die Analyse im bisherigen Verhalten (Eingangsbelege).
      </p>
      <form action={handleSave} className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="sm:col-span-2 lg:col-span-3">
          <Input
            label="Firmenname (juristisch)"
            name="legalName"
            placeholder="Vivahome GmbH"
            defaultValue={initial.legalName}
          />
        </div>
        <Input
          label="Handelsname (optional)"
          name="tradeName"
          placeholder="Viva Home"
          defaultValue={initial.tradeName}
        />
        <Input
          label="USt-IdNr. (optional)"
          name="vatId"
          placeholder="DE123456789"
          defaultValue={initial.vatId}
        />
        <Input
          label="Land (ISO, optional)"
          name="countryCode"
          placeholder="DE"
          maxLength={2}
          defaultValue={initial.countryCode}
        />
        <div className="sm:col-span-2 lg:col-span-3">
          <Input
            label="Strasse (optional)"
            name="street"
            placeholder="Musterstrasse 1"
            defaultValue={initial.street}
          />
        </div>
        <Input
          label="PLZ (optional)"
          name="zip"
          placeholder="12345"
          defaultValue={initial.zip}
        />
        <Input
          label="Ort (optional)"
          name="city"
          placeholder="Berlin"
          defaultValue={initial.city}
        />
        <div className="sm:col-span-2 lg:col-span-3">
          <button
            type="submit"
            disabled={isPending}
            className="rounded-2xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
          >
            {isPending ? "Wird gespeichert..." : "Speichern"}
          </button>
        </div>
        {error ? <p className="text-sm font-medium text-danger sm:col-span-2 lg:col-span-3">{error}</p> : null}
        {success ? <p className="text-sm font-medium text-primary sm:col-span-2 lg:col-span-3">{success}</p> : null}
        {initial.updatedAt ? (
          <p className="text-xs text-muted-foreground sm:col-span-2 lg:col-span-3">
            Zuletzt aktualisiert: {new Date(initial.updatedAt).toLocaleString("de-DE")}
          </p>
        ) : null}
      </form>
    </Card>
  );
}
