"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { AI_PROVIDERS, type AiProvider } from "@/lib/ai/types";

type AiInitial = {
  provider: AiProvider;
  model: string;
  hasApiKey: boolean;
  baseUrl: string;
  ocrServiceUrl: string;
};

export function AiSettingsForm({ initial }: { initial: AiInitial }) {
  const [provider, setProvider] = useState<AiProvider>(initial.provider);
  const [model, setModel] = useState(initial.model);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const availableModels = AI_PROVIDERS[provider].models;

  function handleProviderChange(newProvider: AiProvider) {
    setProvider(newProvider);
    const firstModel = AI_PROVIDERS[newProvider].models[0];
    if (firstModel) {
      setModel(firstModel.id);
    }
  }

  function handleSave(formData: FormData) {
    setError(null);
    setSuccess(null);
    setTestResult(null);

    const apiKey = formData.get("apiKey") as string;
    const baseUrl = formData.get("baseUrl") as string;
    const ocrServiceUrl = formData.get("ocrServiceUrl") as string;

    startTransition(async () => {
      const res = await fetch("/api/admin/ai/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          model,
          apiKey: apiKey || undefined,
          baseUrl: baseUrl || null,
          ocrServiceUrl: ocrServiceUrl || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Fehler beim Speichern.");
        return;
      }

      setSuccess("KI-Konfiguration wurde gespeichert.");
      router.refresh();
    });
  }

  function handleTest(formData: FormData) {
    setTestResult(null);
    setError(null);
    setSuccess(null);

    const apiKey = formData.get("apiKey") as string;
    const baseUrl = formData.get("baseUrl") as string;

    startTransition(async () => {
      const res = await fetch("/api/admin/ai/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          model,
          apiKey: apiKey || undefined,
          baseUrl: baseUrl || null,
        }),
      });

      const data = await res.json();
      setTestResult(data);
    });
  }

  return (
    <>
      <Card>
        <h2 className="text-lg font-semibold tracking-tight">KI-Provider</h2>
        <form action={handleSave} className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm font-medium">Provider</label>
            <select
              value={provider}
              onChange={(e) => handleProviderChange(e.target.value as AiProvider)}
              className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            >
              {Object.entries(AI_PROVIDERS).map(([key, value]) => (
                <option key={key} value={key}>
                  {value.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Modell</label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            >
              {availableModels.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          <Input
            label={initial.hasApiKey ? "API-Key (leer = beibehalten)" : "API-Key"}
            name="apiKey"
            type="password"
            required={!initial.hasApiKey}
            placeholder={initial.hasApiKey ? "********" : `${AI_PROVIDERS[provider].name} API-Key`}
          />

          <Input
            label="Base URL (optional)"
            name="baseUrl"
            type="url"
            placeholder="https://api.example.com/v1"
            defaultValue={initial.baseUrl}
          />

          <Input
            label="OCR-Service URL (optional)"
            name="ocrServiceUrl"
            type="url"
            placeholder="http://ocr-service:8000"
            defaultValue={initial.ocrServiceUrl}
          />

          <div className="sm:col-span-2 lg:col-span-3">
            <button
              type="submit"
              disabled={isPending}
              className="rounded-2xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
            >
              {isPending ? "Wird gespeichert..." : "Speichern"}
            </button>
          </div>

          {error ? (
            <p className="text-sm font-medium text-danger sm:col-span-2 lg:col-span-3">{error}</p>
          ) : null}
          {success ? (
            <p className="text-sm font-medium text-primary sm:col-span-2 lg:col-span-3">{success}</p>
          ) : null}
        </form>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold tracking-tight">Verbindung testen</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Testet die Verbindung zum KI-Provider mit den aktuellen Einstellungen.
        </p>
        <form action={handleTest} className="mt-4">
          <input type="hidden" name="apiKey" value="" />
          <input type="hidden" name="baseUrl" value={initial.baseUrl} />
          <button
            type="submit"
            disabled={isPending}
            className="rounded-2xl border border-border bg-card px-5 py-3 text-sm font-semibold transition hover:border-primary/40 hover:text-primary disabled:opacity-50"
          >
            {isPending ? "Wird getestet..." : "Verbindung testen"}
          </button>

          {testResult ? (
            <div
              className={`mt-4 rounded-xl border p-4 ${
                testResult.success
                  ? "border-primary/30 bg-primary/5 text-primary"
                  : "border-danger/30 bg-danger/5 text-danger"
              }`}
            >
              <p className="text-sm font-medium">
                {testResult.success ? "Erfolg" : "Fehler"}
              </p>
              <p className="mt-1 text-sm">{testResult.message}</p>
            </div>
          ) : null}
        </form>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold tracking-tight">Hinweise</h2>
        <div className="mt-4 space-y-3 text-sm text-muted-foreground">
          <p>
            <strong>OpenAI:</strong> Benoetigt einen API-Key von{" "}
            <a
              href="https://platform.openai.com/api-keys"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              platform.openai.com
            </a>
          </p>
          <p>
            <strong>Anthropic:</strong> Benoetigt einen API-Key von{" "}
            <a
              href="https://console.anthropic.com/settings/keys"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              console.anthropic.com
            </a>
          </p>
          <p>
            <strong>Google:</strong> Benoetigt einen API-Key von{" "}
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              aistudio.google.com
            </a>
          </p>
          <p className="pt-2 border-t border-border">
            <strong>OCR-Service:</strong> Optional. Wird fuer schnellere Bildverarbeitung genutzt.
            Wenn nicht konfiguriert, wird direkt der KI-Provider verwendet.
          </p>
        </div>
      </Card>
    </>
  );
}
