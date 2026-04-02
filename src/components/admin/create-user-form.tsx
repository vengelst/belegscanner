"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export function CreateUserForm() {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleSubmit(formData: FormData) {
    setError(null);
    setSuccess(null);

    startTransition(async () => {
      const response = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: formData.get("email"),
          name: formData.get("name"),
          password: formData.get("password"),
          role: formData.get("role") ?? "USER",
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error ?? "Fehler beim Anlegen.");
        return;
      }

      setSuccess("Benutzer wurde angelegt.");
      router.refresh();
    });
  }

  return (
    <Card>
      <h2 className="text-xl font-semibold tracking-tight">Neuen Benutzer anlegen</h2>
      <form action={handleSubmit} className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Input label="Name" name="name" required placeholder="Max Mustermann" />
        <Input label="E-Mail" name="email" type="email" required placeholder="max@firma.de" />
        <Input
          label="Passwort"
          name="password"
          type="password"
          required
          placeholder="Mind. 8 Zeichen"
          minLength={8}
        />
        <label htmlFor="role" className="grid gap-2 text-sm font-medium">
          <span>Rolle</span>
          <select
            id="role"
            name="role"
            className="h-12 rounded-2xl border border-border bg-background px-4 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
          >
            <option value="USER">User</option>
            <option value="ADMIN">Admin</option>
          </select>
        </label>
        <div className="sm:col-span-2 lg:col-span-4">
          <button
            type="submit"
            disabled={isPending}
            className="rounded-2xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isPending ? "Wird angelegt..." : "Benutzer anlegen"}
          </button>
        </div>
        {error ? <p className="text-sm font-medium text-danger sm:col-span-2 lg:col-span-4">{error}</p> : null}
        {success ? <p className="text-sm font-medium text-primary sm:col-span-2 lg:col-span-4">{success}</p> : null}
      </form>
    </Card>
  );
}
