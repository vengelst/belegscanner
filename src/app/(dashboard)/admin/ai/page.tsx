import { prisma } from "@/lib/prisma";
import { AiSettingsForm } from "@/components/admin/ai-settings-form";

export const dynamic = "force-dynamic";

export default async function AiSettingsPage() {
  const config = await prisma.aiConfig.findUnique({
    where: { id: "singleton" },
  });

  const initial = config
    ? {
        provider: config.provider as "openai" | "anthropic" | "google",
        model: config.model,
        hasApiKey: !!config.apiKeyEnc,
        baseUrl: config.baseUrl ?? "",
        ocrServiceUrl: config.ocrServiceUrl ?? "",
      }
    : {
        provider: "openai" as const,
        model: "gpt-4o-mini",
        hasApiKey: !!process.env.OPENAI_API_KEY,
        baseUrl: "",
        ocrServiceUrl: process.env.OCR_SERVICE_URL ?? "http://ocr-service:8000",
      };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">KI-Einstellungen</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Konfigurieren Sie den KI-Provider fuer die Beleganalyse.
        </p>
      </div>
      <AiSettingsForm initial={initial} />
    </div>
  );
}
