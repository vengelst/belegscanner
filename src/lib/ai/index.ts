import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/encryption";
import type { AiConfig, AiProvider, AiProviderInterface } from "./types";
import { OpenAIProvider } from "./providers/openai";
import { AnthropicProvider } from "./providers/anthropic";
import { GoogleProvider } from "./providers/google";

export * from "./types";
export { OpenAIProvider } from "./providers/openai";
export { AnthropicProvider } from "./providers/anthropic";
export { GoogleProvider } from "./providers/google";

export async function getAiConfig(): Promise<AiConfig | null> {
  const dbConfig = await prisma.aiConfig.findUnique({
    where: { id: "singleton" },
  });

  if (dbConfig?.apiKeyEnc) {
    try {
      const apiKey = decrypt(dbConfig.apiKeyEnc);
      return {
        provider: dbConfig.provider as AiProvider,
        model: dbConfig.model,
        apiKey,
        baseUrl: dbConfig.baseUrl ?? undefined,
        ocrServiceUrl: dbConfig.ocrServiceUrl ?? undefined,
      };
    } catch {
      console.warn("[AI] Fehler beim Entschluesseln des API-Keys aus der DB");
    }
  }

  const envApiKey = process.env.OPENAI_API_KEY;
  if (envApiKey) {
    return {
      provider: "openai",
      model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
      apiKey: envApiKey,
      ocrServiceUrl: process.env.OCR_SERVICE_URL ?? undefined,
    };
  }

  return null;
}

export function createAiProvider(config: AiConfig): AiProviderInterface {
  switch (config.provider) {
    case "openai":
      return new OpenAIProvider(config);
    case "anthropic":
      return new AnthropicProvider(config);
    case "google":
      return new GoogleProvider(config);
    default:
      throw new Error(`Unbekannter AI-Provider: ${config.provider}`);
  }
}

export async function getAiProvider(): Promise<AiProviderInterface | null> {
  const config = await getAiConfig();
  if (!config) {
    return null;
  }
  return createAiProvider(config);
}

export async function getOcrServiceUrl(): Promise<string | null> {
  const dbConfig = await prisma.aiConfig.findUnique({
    where: { id: "singleton" },
    select: { ocrServiceUrl: true },
  });

  if (dbConfig?.ocrServiceUrl) {
    return dbConfig.ocrServiceUrl;
  }

  return process.env.OCR_SERVICE_URL ?? null;
}
