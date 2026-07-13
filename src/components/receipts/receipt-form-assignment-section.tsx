"use client";

import { Card } from "@/components/ui/card";
import { SelectField } from "@/components/ui/select-field";
import type { Purpose, Category, Country, Vehicle, PrefillSource } from "@/lib/receipts/form-helpers";

type Props = {
  purposes: Purpose[];
  categories: Category[];
  countries: Country[];
  vehicles: Vehicle[];
  purposeId: string;
  categoryId: string;
  countryId: string;
  vehicleId: string;
  prefillSource: PrefillSource;
  setPurposeId: (v: string) => void;
  setCategoryId: (v: string) => void;
  setCountryId: (v: string) => void;
  setCountryManuallyChanged: (v: boolean) => void;
  setVehicleId: (v: string) => void;
};

export function ReceiptFormAssignmentSection({
  purposes,
  categories,
  countries,
  vehicles,
  purposeId,
  categoryId,
  countryId,
  vehicleId,
  prefillSource,
  setPurposeId,
  setCategoryId,
  setCountryId,
  setCountryManuallyChanged,
  setVehicleId,
}: Props) {
  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Zuordnung</h2>
          <p className="mt-1 text-sm text-muted-foreground">Diese Felder werden zuerst aus der letzten Folgeerfassung, dann aus deinen Standardwerten vorbelegt.</p>
        </div>
        {prefillSource !== "none" ? (
          <span className="rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
            {prefillSource === "session" ? "Vorbelegt aus letzter Erfassung" : "Vorbelegt aus deinen Standardwerten"}
          </span>
        ) : null}
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <SelectField label="Zweck" name="purposeId" required value={purposeId} onChange={setPurposeId}>
          <option value="">-- Zweck waehlen --</option>
          {purposes.map((purpose) => (
            <option key={purpose.id} value={purpose.id}>{purpose.name}</option>
          ))}
        </SelectField>
        <SelectField label="Kategorie" name="categoryId" required value={categoryId} onChange={setCategoryId}>
          <option value="">-- Kategorie waehlen --</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>{category.name}</option>
          ))}
        </SelectField>
        <SelectField label="Land" name="countryId" value={countryId} onChange={(value) => { setCountryManuallyChanged(true); setCountryId(value); }}>
          <option value="">-- optional --</option>
          {countries.map((country) => (
            <option key={country.id} value={country.id}>{country.name}{country.code ? ` (${country.code})` : ""}</option>
          ))}
        </SelectField>
        <SelectField label="Kfz" name="vehicleId" value={vehicleId} onChange={setVehicleId}>
          <option value="">-- optional --</option>
          {vehicles.map((vehicle) => (
            <option key={vehicle.id} value={vehicle.id}>{vehicle.plate}{vehicle.description ? ` - ${vehicle.description}` : ""}</option>
          ))}
        </SelectField>
        <label className="grid gap-1 text-sm font-medium sm:col-span-2 lg:col-span-2">
          <span className="text-xs text-muted-foreground">Bemerkung</span>
          <textarea
            name="remark"
            rows={2}
            maxLength={2000}
            placeholder="Freitext (optional)"
            className="rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
          />
        </label>
      </div>
    </Card>
  );
}
