"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type SmtpInitial = {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  fromAddress: string;
  replyToAddress: string;
  hasPassword: boolean;
} | null;

export function SmtpSettingsForm({ initial }: { initial: SmtpInitial }) {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleSave(formData: FormData) {
    setError(null);
    setSuccess(null);

    const password = formData.get("password") as string;

    startTransition(async () => {
      const res = await fetch("/api/settings/smtp", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          host: formData.get("host"),
          port: Number(formData.get("port")),
          secure: formData.get("secure") === "on",
          username: formData.get("username"),
          password: password || undefined,
          fromAddress: formData.get("fromAddress"),
          replyToAddress: (formData.get("replyToAddress") as string) || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Fehler beim Speichern.");
        return;
      }
      setSuccess("SMTP-Konfiguration wurde gespeichert.");
      router.refresh();
    });
  }

  function handleTest() {
    setTestResult(null);
    startTransition(async () => {
      const res = await fetch("/api/settings/smtp/test", { method: "POST" });
      const data = await res.json();
      setTestResult(data.message ?? data.error);
    });
  }

  return (
    <>
      <Card>
        <h2 className="text-lg font-semibold tracking-tight">SMTP-Server</h2>
        <form action={handleSave} className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Input label="Host" name="host" required placeholder="smtp.example.com" defaultValue={initial?.host ?? ""} />
          <Input label="Port" name="port" type="number" required placeholder="587" defaultValue={String(initial?.port ?? 587)} />
          <label className="flex items-center gap-2 text-sm font-medium sm:pt-5">
            <input type="checkbox" name="secure" defaultChecked={initial?.secure ?? true} className="h-4 w-4 rounded border-border accent-primary" />
            TLS/SSL
          </label>
          <Input label="Benutzername" name="username" required placeholder="user@example.com" defaultValue={initial?.username ?? ""} />
          <Input
            label={initial?.hasPassword ? "Passwort (leer = beibehalten)" : "Passwort"}
            name="password"
            type="password"
            required={!initial?.hasPassword}
            placeholder={initial?.hasPassword ? "********" : "SMTP-Passwort"}
          />
          <Input label="Absender-Adresse" name="fromAddress" type="email" required placeholder="belege@firma.de" defaultValue={initial?.fromAddress ?? ""} />
          <Input label="Reply-To (optional)" name="replyToAddress" type="email" placeholder="antwort@firma.de" defaultValue={initial?.replyToAddress ?? ""} />
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
        </form>
      </Card>
      {initial ? (
        <Card>
          <h2 className="text-lg font-semibold tracking-tight">Verbindung testen</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Sendet eine Test-Mail an die konfigurierte Absender-Adresse.
          </p>
          <div className="mt-4">
            <button
              type="button"
              onClick={handleTest}
              disabled={isPending}
              className="rounded-2xl border border-border bg-card px-5 py-3 text-sm font-semibold transition hover:border-primary/40 hover:text-primary disabled:opacity-50"
            >
              {isPending ? "Wird getestet..." : "Test-Mail senden"}
            </button>
            {testResult ? (
              <p className="mt-2 text-sm font-medium text-primary">{testResult}</p>
            ) : null}
          </div>
        </Card>
      ) : null}
    </>
  );
}
