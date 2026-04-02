"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type Profile = {
  id: string;
  name: string;
  datevAddress: string;
  senderAddress: string;
  subjectTemplate: string;
  bodyTemplate: string;
  isDefault: boolean;
  active: boolean;
};

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

function CreateProfileForm() {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
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
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Fehler beim Anlegen.");
        return;
      }
      setSuccess("DATEV-Profil wurde angelegt.");
      router.refresh();
    });
  }

  return (
    <Card>
      <h2 className="text-lg font-semibold tracking-tight">Neues Profil anlegen</h2>
      <form action={handleSubmit} className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Input label="Profilname" name="name" required placeholder="z.B. Hauptprofil" />
        <Input label="DATEV-Adresse" name="datevAddress" type="email" required placeholder="datev@steuerberater.de" />
        <Input label="Absender-Adresse" name="senderAddress" type="email" required placeholder="belege@firma.de" />
        <Input label="Betreff-Template (optional)" name="subjectTemplate" placeholder="Beleg {date} - {supplier}" />
        <label className="grid gap-1 text-sm font-medium sm:col-span-2 lg:col-span-2">
          <span className="text-xs text-muted-foreground">Body-Template (optional)</span>
          <textarea
            name="bodyTemplate"
            rows={3}
            placeholder="Platzhalter: {date}, {supplier}, {amount}, {currency}, {user}"
            className="rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
          />
        </label>
        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" name="isDefault" className="h-4 w-4 rounded border-border accent-primary" />
          Als Standard verwenden
        </label>
        <div className="sm:col-span-2 lg:col-span-3">
          <button
            type="submit"
            disabled={isPending}
            className="rounded-2xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
          >
            {isPending ? "..." : "Profil anlegen"}
          </button>
        </div>
        {error ? <p className="text-sm font-medium text-danger sm:col-span-2 lg:col-span-3">{error}</p> : null}
        {success ? <p className="text-sm font-medium text-primary sm:col-span-2 lg:col-span-3">{success}</p> : null}
      </form>
    </Card>
  );
}

function ProfileCard({ profile }: { profile: Profile }) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
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
          <p className="text-sm text-muted-foreground">DATEV: {profile.datevAddress}</p>
          <p className="text-sm text-muted-foreground">Absender: {profile.senderAddress}</p>
          {profile.subjectTemplate ? (
            <p className="text-xs text-muted-foreground">Betreff: {profile.subjectTemplate}</p>
          ) : null}
        </div>
        <div className="flex gap-2">
          {!profile.isDefault && profile.active ? (
            <button type="button" onClick={handleSetDefault} disabled={isPending} className="text-xs font-medium text-primary hover:underline disabled:opacity-50">
              Als Standard
            </button>
          ) : null}
          <button type="button" onClick={handleToggleActive} disabled={isPending} className={`text-xs font-medium hover:underline disabled:opacity-50 ${profile.active ? "text-danger" : "text-primary"}`}>
            {profile.active ? "Deaktivieren" : "Aktivieren"}
          </button>
        </div>
      </div>
      {message ? <p className="mt-2 text-sm font-medium text-primary">{message}</p> : null}
    </Card>
  );
}
