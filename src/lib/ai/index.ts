import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/encryption";
import type { OrganizationIdentity } from "@/lib/organization";
import { getOrganizationProfile } from "@/lib/organization";
import type { AiConfig, AiProvider, AiProviderInterface } from "./types";
import { OpenAIProvider } from "./providers/openai";
import { AnthropicProvider } from "./providers/anthropic";
import { GoogleProvider } from "./providers/google";

export * from "./types";
export { OpenAIProvider } from "./providers/openai";
export { AnthropicProvider } from "./providers/anthropic";
export { GoogleProvider } from "./providers/google";
export {
  buildSystemPrompt,
  normalizeExtractionResult,
  normalizePartyRole,
} from "./organization-prompt";

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

export function createAiProvider(
  config: AiConfig,
  organization: OrganizationIdentity | null = null,
): AiProviderInterface {
  switch (config.provider) {
    case "openai":
      return new OpenAIProvider(config, organization);
    case "anthropic":
      return new AnthropicProvider(config, organization);
    case "google":
      return new GoogleProvider(config, organization);
    default:
      throw new Error(`Unbekannter AI-Provider: ${config.provider}`);
  }
}

export async function getAiProvider(): Promise<AiProviderInterface | null> {
  const config = await getAiConfig();
  if (!config) {
    return null;
  }
  const organization = await getOrganizationProfile();
  return createAiProvider(config, organization);
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
