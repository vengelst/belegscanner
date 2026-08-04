"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export function CreateUserForm() {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [role, setRole] = useState<"USER" | "ADMIN">("USER");
  const [canSendWithoutApproval, setCanSendWithoutApproval] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleSubmit(formData: FormData) {
    setError(null);
    setSuccess(null);

    startTransition(async () => {
      const selectedRole = (formData.get("role") as string) === "ADMIN" ? "ADMIN" : "USER";
      const response = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: formData.get("email"),
          name: formData.get("name"),
          password: formData.get("password"),
          role: selectedRole,
          canSendWithoutApproval: selectedRole === "USER" ? canSendWithoutApproval : false,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error ?? "Fehler beim Anlegen.");
        return;
      }

      setSuccess("Benutzer wurde angelegt.");
      setCanSendWithoutApproval(false);
      setRole("USER");
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
            value={role}
            onChange={(e) => {
              const next = e.target.value === "ADMIN" ? "ADMIN" : "USER";
              setRole(next);
              if (next === "ADMIN") setCanSendWithoutApproval(false);
            }}
            className="bb-select input-3d h-10 rounded-xl px-3 text-sm outline-none transition-all duration-200 focus:ring-2 focus:ring-primary/20"
          >
            <option value="USER">User</option>
            <option value="ADMIN">Admin</option>
          </select>
        </label>
        {role === "USER" ? (
          <label className="flex items-start gap-3 sm:col-span-2 lg:col-span-4">
            <input
              type="checkbox"
              checked={canSendWithoutApproval}
              onChange={(e) => setCanSendWithoutApproval(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-border"
            />
            <span className="text-sm">
              <span className="font-medium">Versand ohne Beleg-Freigabe</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                User darf Belege an DATEV senden, ohne dass der Pruefstatus Freigegeben sein muss. Das Vier-Augen-Prinzip entfaellt fuer diesen User.
              </span>
            </span>
          </label>
        ) : (
          <p className="text-xs text-muted-foreground sm:col-span-2 lg:col-span-4">
            Admins duerfen Belege ohnehin ohne Freigabe senden. Das Recht „Versand ohne Beleg-Freigabe“ ist nur fuer User relevant.
          </p>
        )}
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
