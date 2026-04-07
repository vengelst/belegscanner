"use client";

import { useState, useTransition, type FormEvent } from "react";
import { signIn } from "next-auth/react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

async function authenticate(provider: "email-password" | "pin-login", formData: FormData) {
  const response = await signIn(provider, {
    redirect: false,
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
    pin: String(formData.get("pin") ?? "")
  });

  if (!response || response.error) {
    throw new Error("Anmeldung fehlgeschlagen. Bitte Eingaben pr?fen.");
  }

  window.location.href = "/receipts";
}

export function LoginCard() {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const submit = (provider: "email-password" | "pin-login") => (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      try {
        await authenticate(provider, formData);
      } catch (submitError) {
        setError(submitError instanceof Error ? submitError.message : "Anmeldung fehlgeschlagen.");
      }
    });
  };

  return (
    <Card className="w-full max-w-5xl overflow-hidden p-0">
      <div className="grid md:grid-cols-[1.2fr_0.8fr]">
        <div className="bg-[linear-gradient(135deg,color-mix(in_oklab,var(--primary)_20%,transparent),transparent),linear-gradient(180deg,color-mix(in_oklab,var(--accent)_18%,transparent),transparent)] p-8 text-card-foreground sm:p-10">
          <p className="text-sm font-medium uppercase tracking-[0.3em] text-muted-foreground">
            BelegBox
          </p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight">
            Belege schnell erfassen, sauber strukturieren, sicher versenden.
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-6 text-muted-foreground">
            Der MVP trennt Login, Stammdaten, Belegmetadaten und Druckansicht sauber voneinander.
          </p>
        </div>
        <div className="p-6 sm:p-8">
          <div className="space-y-6">
            <section className="space-y-3">
              <div>
                <h2 className="text-xl font-semibold tracking-tight">E-Mail-Login</h2>
                <p className="text-sm text-muted-foreground">
                  Rollenbasierter Zugang fuer Verwaltung und regulare Erfassung.
                </p>
              </div>
              <form onSubmit={submit("email-password")} className="space-y-3">
                <Input label="E-Mail" name="email" type="email" placeholder="name@firma.de" required />
                <Input label="Passwort" name="password" type="password" placeholder="Passwort" required />
                <button
                  type="submit"
                  disabled={isPending}
                  className="w-full rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isPending ? "Pruefe Zugang..." : "Anmelden"}
                </button>
              </form>
            </section>
            <section className="space-y-3 border-t border-border pt-6">
              <div>
                <h2 className="text-xl font-semibold tracking-tight">PIN-Login</h2>
                <p className="text-sm text-muted-foreground">
                  Fuer Kiosk und mobile Erfassung. Im MVP erfolgt die Zuordnung ueber E-Mail plus PIN.
                </p>
              </div>
              <form onSubmit={submit("pin-login")} className="space-y-3">
                <Input label="E-Mail" name="email" type="email" placeholder="name@firma.de" required />
                <Input label="PIN" name="pin" inputMode="numeric" pattern="[0-9]{4}" maxLength={4} placeholder="1234" required />
                <button
                  type="submit"
                  disabled={isPending}
                  className="w-full rounded-2xl border border-border bg-card px-4 py-3 text-sm font-semibold transition hover:border-primary/40 hover:text-primary disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isPending ? "Pruefe PIN..." : "Mit PIN anmelden"}
                </button>
              </form>
            </section>
            {error ? <p className="text-sm font-medium text-danger">{error}</p> : null}
          </div>
        </div>
      </div>
    </Card>
  );
}
