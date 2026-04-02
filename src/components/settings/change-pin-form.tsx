"use client";

import { useState, useTransition } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export function ChangePinForm({ hasPin }: { hasPin: boolean }) {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);
    setSuccess(null);

    const currentPassword = formData.get("currentPassword") as string;
    const pin = formData.get("pin") as string;

    if (!/^\d{4}$/.test(pin)) {
      setError("Die PIN muss aus genau 4 Ziffern bestehen.");
      return;
    }

    startTransition(async () => {
      const res = await fetch("/api/users/me/pin", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, pin }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Fehler beim Aendern der PIN.");
        return;
      }
      setSuccess(data.message);
    });
  }

  return (
    <Card>
      <h2 className="text-xl font-semibold tracking-tight">
        {hasPin ? "PIN aendern" : "PIN einrichten"}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Die 4-stellige PIN ermoeglicht den schnellen Kiosk-Login.
      </p>
      <form action={handleSubmit} className="mt-4 grid gap-4 sm:grid-cols-2">
        <Input
          label="Aktuelles Passwort"
          name="currentPassword"
          type="password"
          required
          placeholder="Zur Bestaetigung"
        />
        <Input
          label="Neue PIN"
          name="pin"
          inputMode="numeric"
          pattern="[0-9]{4}"
          maxLength={4}
          required
          placeholder="4 Ziffern"
        />
        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={isPending}
            className="rounded-2xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isPending ? "Wird gespeichert..." : hasPin ? "PIN aendern" : "PIN setzen"}
          </button>
        </div>
        {error ? <p className="text-sm font-medium text-danger sm:col-span-2">{error}</p> : null}
        {success ? <p className="text-sm font-medium text-primary sm:col-span-2">{success}</p> : null}
      </form>
    </Card>
  );
}
