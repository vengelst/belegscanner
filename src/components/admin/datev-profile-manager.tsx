"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  DATEV_BELEGTYP_VALUES,
  datevBelegtypLabels,
  type DatevBelegtyp,
} from "@/lib/datev/belegtyp";

type BelegtypAddress = { belegtyp: DatevBelegtyp; datevAddress: string };

type Profile = {
  id: string;
  name: string;
  datevAddress: string;
  senderAddress: string;
  subjectTemplate: string;
  bodyTemplate: string;
  isDefault: boolean;
  active: boolean;
  belegtypAddresses: BelegtypAddress[];
};

const UPLOAD_MAIL_HINT =
  "In DATEV Unternehmen online → Belege → Upload Mail je Belegtyp eine Zieladresse anlegen und hier eintragen. Der Belegtyp wird über diese Adresse gesteuert.";

/** Leeres Adressformular: pro Belegtyp ein Feld. */
function emptyAddressMap(): Record<DatevBelegtyp, string> {
  return DATEV_BELEGTYP_VALUES.reduce((acc, belegtyp) => {
    acc[belegtyp] = "";
    return acc;
  }, {} as Record<DatevBelegtyp, string>);
}

function toAddressMap(addresses: BelegtypAddress[]): Record<DatevBelegtyp, string> {
  const map = emptyAddressMap();
  for (const entry of addresses) {
    map[entry.belegtyp] = entry.datevAddress;
  }
  return map;
}

/** Nur ausgefuellte Adressen an die API schicken; leer = nicht konfiguriert. */
function toAddressPayload(map: Record<DatevBelegtyp, string>): BelegtypAddress[] {
  return DATEV_BELEGTYP_VALUES.flatMap((belegtyp) => {
    const value = map[belegtyp].trim();
    return value ? [{ belegtyp, datevAddress: value }] : [];
  });
}

export function DatevProfileManager({ profiles }: { profiles: Profile[] }) {
  return (
    <>
      <CreateProfileForm />
      {profiles.length === 0 ? (
        <Card>
          <p className="text-sm text-muted-foreground">Noch keine DATEV-Profile angelegt.</p>
        </Card>
      ) : (
        profiles.map((p) => <ProfileCard key={p.id} profile={p} />)
      )}
    </>
  );
}

function BelegtypAddressFields({
  idPrefix,
  addresses,
  onChange,
}: {
  idPrefix: string;
  addresses: Record<DatevBelegtyp, string>;
  onChange: (belegtyp: DatevBelegtyp, value: string) => void;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {DATEV_BELEGTYP_VALUES.map((belegtyp) => (
        <Input
          key={belegtyp}
          label={datevBelegtypLabels[belegtyp]}
          id={`${idPrefix}-${belegtyp}`}
          type="email"
          value={addresses[belegtyp]}
          placeholder="upload-mail@datev.de"
          onChange={(event) => onChange(belegtyp, event.target.value)}
        />
      ))}
    </div>
  );
}

function CreateProfileForm() {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [addresses, setAddresses] = useState<Record<DatevBelegtyp, string>>(emptyAddressMap);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleSubmit(formData: FormData) {
    setError(null);
    setSuccess(null);

    startTransition(async () => {
      const res = await fetch("/api/settings/datev", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.get("name"),
          datevAddress: formData.get("datevAddress"),
          senderAddress: formData.get("senderAddress"),
          subjectTemplate: formData.get("subjectTemplate") || undefined,
          bodyTemplate: formData.get("bodyTemplate") || undefined,
          isDefault: formData.get("isDefault") === "on",
          belegtypAddresses: toAddressPayload(addresses),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Fehler beim Anlegen.");
        return;
      }
      setSuccess("DATEV-Profil wurde angelegt.");
      setAddresses(emptyAddressMap());
      router.refresh();
    });
  }

  return (
    <Card>
      <h2 className="text-lg font-semibold tracking-tight">Neues Profil anlegen</h2>
      <form action={handleSubmit} className="mt-4 space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Input label="Profilname" name="name" required placeholder="z.B. Hauptprofil" />
          <Input
            label="Standard-Adresse (Rechnungseingang / Fallback)"
            name="datevAddress"
            type="email"
            required
            placeholder="datev@steuerberater.de"
          />
          <Input label="Absender-Adresse" name="senderAddress" type="email" required placeholder="belege@firma.de" />
          <Input label="Betreff-Template (optional)" name="subjectTemplate" placeholder="[{belegtyp}] Beleg {date} - {supplier}" />
          <label className="grid gap-1 text-sm font-medium sm:col-span-2 lg:col-span-2">
            <span className="text-xs text-muted-foreground">Body-Template (optional)</span>
            <textarea
              name="bodyTemplate"
              rows={3}
              placeholder="Platzhalter: {belegtyp}, {date}, {supplier}, {amount}, {currency}, {user}"
              className="bb-input bb-textarea input-3d rounded-xl px-3 py-2.5 text-sm outline-none transition-all duration-200 focus:ring-2 focus:ring-primary/20"
            />
          </label>
          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" name="isDefault" className="h-4 w-4 rounded border-border accent-primary" />
            Als Standard verwenden
          </label>
        </div>

        <div className="space-y-3 rounded-2xl border border-border p-4">
          <div>
            <h3 className="text-sm font-semibold">Upload-Mail-Adressen je Belegtyp</h3>
            <p className="mt-1 text-xs text-muted-foreground">{UPLOAD_MAIL_HINT}</p>
          </div>
          <BelegtypAddressFields
            idPrefix="datev-new"
            addresses={addresses}
            onChange={(belegtyp, value) => setAddresses((current) => ({ ...current, [belegtyp]: value }))}
          />
        </div>

        <div className="space-y-2">
          <button
            type="submit"
            disabled={isPending}
            className="rounded-2xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
          >
            {isPending ? "..." : "Profil anlegen"}
          </button>
          {error ? <p className="text-sm font-medium text-danger">{error}</p> : null}
          {success ? <p className="text-sm font-medium text-primary">{success}</p> : null}
        </div>
      </form>
    </Card>
  );
}

function ProfileCard({ profile }: { profile: Profile }) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [addressError, setAddressError] = useState<string | null>(null);
  const [addresses, setAddresses] = useState<Record<DatevBelegtyp, string>>(
    () => toAddressMap(profile.belegtypAddresses),
  );
  const router = useRouter();

  function handleSetDefault() {
    startTransition(async () => {
      setMessage(null);
      const res = await fetch(`/api/settings/datev/${profile.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isDefault: true }),
      });
      const data = await res.json();
      setMessage(res.ok ? "Als Standard gesetzt." : data.error);
      router.refresh();
    });
  }

  function handleToggleActive() {
    if (profile.active) {
      startTransition(async () => {
        setMessage(null);
        const res = await fetch(`/api/settings/datev/${profile.id}`, { method: "DELETE" });
        const data = await res.json();
        setMessage(data.message ?? data.error);
        router.refresh();
      });
    } else {
      startTransition(async () => {
        setMessage(null);
        const res = await fetch(`/api/settings/datev/${profile.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ active: true }),
        });
        const data = await res.json();
        setMessage(res.ok ? "Profil aktiviert." : data.error);
        router.refresh();
      });
    }
  }

  function handleSaveAddresses() {
    setMessage(null);
    setAddressError(null);

    startTransition(async () => {
      const res = await fetch(`/api/settings/datev/${profile.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ belegtypAddresses: toAddressPayload(addresses) }),
      });
      const data = await res.json();
      if (!res.ok) {
        const details = data.details && typeof data.details === "object"
          ? Object.values(data.details as Record<string, unknown>)
              .flatMap((value) => (Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []))
              .join(" ")
          : "";
        setAddressError(`${data.error ?? "Speichern fehlgeschlagen."} ${details}`.trim());
        return;
      }
      setMessage("Upload-Mail-Adressen gespeichert.");
      router.refresh();
    });
  }

  const configuredCount = toAddressPayload(addresses).length;

  return (
    <Card className={!profile.active ? "opacity-40" : ""}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold">{profile.name}</h3>
            {profile.isDefault ? (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">Standard</span>
            ) : null}
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${profile.active ? "bg-primary/10 text-primary" : "bg-danger/10 text-danger"}`}>
              {profile.active ? "Aktiv" : "Inaktiv"}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            Standard / Rechnungseingang (Fallback): {profile.datevAddress}
          </p>
          <p className="text-sm text-muted-foreground">Absender: {profile.senderAddress}</p>
          {profile.subjectTemplate ? (
            <p className="text-xs text-muted-foreground">Betreff: {profile.subjectTemplate}</p>
          ) : null}
        </div>
        <div className="flex gap-2">
          {!profile.isDefault && profile.active ? (
            <button type="button" onClick={handleSetDefault} disabled={isPending} className="rounded-lg border border-primary/30 px-2 py-0.5 text-xs font-medium text-primary transition hover:bg-primary/10 disabled:opacity-50">
              Als Standard
            </button>
          ) : null}
          <button type="button" onClick={handleToggleActive} disabled={isPending} className={`rounded-lg border px-2 py-0.5 text-xs font-medium transition disabled:opacity-50 ${profile.active ? "border-danger/30 text-danger hover:bg-danger/10" : "border-primary/30 text-primary hover:bg-primary/10"}`}>
            {profile.active ? "Deaktivieren" : "Aktivieren"}
          </button>
        </div>
      </div>

      <div className="mt-5 space-y-3 rounded-2xl border border-border p-4">
        <div>
          <h4 className="text-sm font-semibold">
            Upload-Mail-Adressen je Belegtyp{" "}
            <span className="font-normal text-muted-foreground">({configuredCount} von {DATEV_BELEGTYP_VALUES.length} konfiguriert)</span>
          </h4>
          <p className="mt-1 text-xs text-muted-foreground">{UPLOAD_MAIL_HINT}</p>
        </div>
        <BelegtypAddressFields
          idPrefix={`datev-${profile.id}`}
          addresses={addresses}
          onChange={(belegtyp, value) => setAddresses((current) => ({ ...current, [belegtyp]: value }))}
        />
        <p className="text-xs text-muted-foreground">
          Leeres Feld = Belegtyp nicht konfiguriert. Belege mit diesem Belegtyp koennen dann nicht versendet werden
          (Ausnahme: Rechnungseingang faellt auf die Standard-Adresse zurueck).
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleSaveAddresses}
            disabled={isPending}
            className="rounded-2xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
          >
            {isPending ? "Wird gespeichert..." : "Adressen speichern"}
          </button>
          {addressError ? <p className="text-sm font-medium text-danger">{addressError}</p> : null}
        </div>
      </div>

      {message ? <p className="mt-2 text-sm font-medium text-primary">{message}</p> : null}
    </Card>
  );
}
