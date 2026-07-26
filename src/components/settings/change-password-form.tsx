"use client";

import { useState, useTransition } from "react";
import { Card } from "@/components/ui/card";
import { PasswordInput } from "@/components/ui/password-input";

export function ChangePasswordForm() {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);
    setSuccess(null);

    const newPassword = formData.get("newPassword") as string;
    const confirmPassword = formData.get("confirmPassword") as string;

    if (newPassword !== confirmPassword) {
      setError("Die neuen Passwoerter stimmen nicht ueberein.");
      return;
    }

    startTransition(async () => {
      const res = await fetch("/api/users/me/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Fehler beim Aendern des Passworts.");
        return;
      }
      setSuccess(data.message);
    });
  }

  return (
    <Card>
      <h2 className="text-xl font-semibold tracking-tight">Passwort aendern</h2>
      <form action={handleSubmit} className="mt-4 grid gap-4 sm:grid-cols-2">
        <PasswordInput
          label="Neues Passwort"
          name="newPassword"
          required
          placeholder="Mind. 8 Zeichen"
          minLength={8}
        />
        <PasswordInput
          label="Neues Passwort bestaetigen"
          name="confirmPassword"
          required
          placeholder="Wiederholung"
          minLength={8}
        />
        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={isPending}
            className="rounded-2xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isPending ? "Wird geaendert..." : "Passwort aendern"}
          </button>
        </div>
        {error ? <p className="text-sm font-medium text-danger sm:col-span-2">{error}</p> : null}
        {success ? <p className="text-sm font-medium text-primary sm:col-span-2">{success}</p> : null}
      </form>
    </Card>
  );
}
