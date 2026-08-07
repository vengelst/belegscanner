"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import {
  DATEV_BELEGTYP_VALUES,
  datevBelegtypHints,
  datevBelegtypLabels,
  type DatevBelegtyp,
  type DatevBelegtypLabelOverrides,
} from "@/lib/datev/belegtyp";

type Props = {
  initial: {
    defaultDatevBelegtyp: DatevBelegtyp;
    datevBelegtypLabelOverrides: DatevBelegtypLabelOverrides;
  };
};

/**
 * Standard-Belegtyp und eigene Bezeichnungen der DATEV-Belegtypen.
 *
 * Der Standard-Belegtyp ist der Startwert jedes neuen Belegs - er greift auch,
 * wenn die Belegerkennung nichts Belastbares liefert. Bezeichnungen sind reine
 * Anzeigenamen; der an DATEV uebergebene Belegtyp bleibt unveraendert.
 */
export function DatevBelegtypSettingsForm({ initial }: Props) {
  const [defaultBelegtyp, setDefaultBelegtyp] = useState<DatevBelegtyp>(initial.defaultDatevBelegtyp);
  const [labels, setLabels] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      DATEV_BELEGTYP_VALUES.map((belegtyp) => [belegtyp, initial.datevBelegtypLabelOverrides[belegtyp] ?? ""]),
    ),
  );
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleSave() {
    setError(null);
    setSuccess(null);

    // Leere Felder werden nicht mitgeschickt - dann gilt der DATEV-Standardname.
    const overrides = Object.fromEntries(
      Object.entries(labels)
        .map(([belegtyp, label]) => [belegtyp, label.trim()])
        .filter(([, label]) => label !== ""),
    );

    startTransition(async () => {
      const res = await fetch("/api/admin/organization", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          defaultDatevBelegtyp: defaultBelegtyp,
          datevBelegtypLabelOverrides: overrides,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Fehler beim Speichern.");
        return;
      }
      setSuccess("Belegtyp-Einstellungen wurden gespeichert.");
      router.refresh();
    });
  }

  return (
    <Card>
      <h2 className="text-lg font-semibold tracking-tight">DATEV-Belegtyp (Kategorie)</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Der <strong>Standard-Belegtyp</strong> ist bei jedem neuen Beleg vorausgewaehlt und greift
        immer dann, wenn die Belegerkennung keinen anderen Typ belegen kann. Jeden anderen Typ
        waehlt der Erfasser bewusst. Die <strong>Bezeichnungen</strong> sind reine Anzeigenamen im
        Belegscanner - der an DATEV uebergebene Belegtyp aendert sich dadurch nicht.
      </p>

      <div className="mt-4 max-w-md">
        <label className="grid gap-1 text-sm font-medium">
          <span className="text-xs text-muted-foreground">Standard-Belegtyp</span>
          <select
            value={defaultBelegtyp}
            onChange={(event) => {
              setSuccess(null);
              setDefaultBelegtyp(event.target.value as DatevBelegtyp);
            }}
            className="bb-input input-3d h-10 rounded-xl px-3 text-sm outline-none transition-all duration-200 focus:ring-2 focus:ring-primary/20"
          >
            {DATEV_BELEGTYP_VALUES.map((belegtyp) => (
              <option key={belegtyp} value={belegtyp}>
                {labels[belegtyp]?.trim() || datevBelegtypLabels[belegtyp]} ({datevBelegtypHints[belegtyp]})
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-6">
        <h3 className="text-sm font-semibold">Eigene Bezeichnungen</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Leer lassen = DATEV-Standardname.
        </p>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          {DATEV_BELEGTYP_VALUES.map((belegtyp) => (
            <label key={belegtyp} className="grid gap-1 text-sm font-medium">
              <span className="text-xs text-muted-foreground">
                {datevBelegtypLabels[belegtyp]} ({datevBelegtypHints[belegtyp]})
              </span>
              <input
                value={labels[belegtyp] ?? ""}
                maxLength={120}
                placeholder={datevBelegtypLabels[belegtyp]}
                onChange={(event) => {
                  setSuccess(null);
                  setLabels((current) => ({ ...current, [belegtyp]: event.target.value }));
                }}
                className="bb-input input-3d h-10 rounded-xl px-3 text-sm outline-none transition-all duration-200 focus:ring-2 focus:ring-primary/20"
              />
            </label>
          ))}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          className="h-10 rounded-2xl bg-primary px-6 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
        >
          {isPending ? "Wird gespeichert..." : "Speichern"}
        </button>
      </div>

      {error ? <p className="mt-3 text-sm font-medium text-danger">{error}</p> : null}
      {success ? <p className="mt-3 text-sm font-medium text-primary">{success}</p> : null}
    </Card>
  );
}
