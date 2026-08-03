import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-auth";
import { createAiProvider, type AiConfig, type AiProvider } from "@/lib/ai";
import { decrypt } from "@/lib/encryption";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const testConfigSchema = z.object({
  provider: z.enum(["openai", "anthropic", "google"]).optional(),
  model: z.string().optional(),
  apiKey: z.string().optional(),
  baseUrl: z.string().url().nullable().optional(),
});

export async function POST(request: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const parsed = testConfigSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validierungsfehler.", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  let config: AiConfig;

  if (parsed.data.apiKey && parsed.data.apiKey !== "********" && parsed.data.provider && parsed.data.model) {
    config = {
      provider: parsed.data.provider as AiProvider,
      model: parsed.data.model,
      apiKey: parsed.data.apiKey,
      baseUrl: parsed.data.baseUrl ?? undefined,
    };
  } else {
    const dbConfig = await prisma.aiConfig.findUnique({
      where: { id: "singleton" },
    });

    if (!dbConfig?.apiKeyEnc) {
      const envApiKey = process.env.OPENAI_API_KEY;
      if (!envApiKey) {
        return NextResponse.json(
          { success: false, message: "Kein API-Key konfiguriert. Bitte speichern Sie zuerst einen API-Key." },
          { status: 400 }
        );
      }

      config = {
        provider: "openai",
        model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
        apiKey: envApiKey,
      };
    } else {
      try {
        const apiKey = decrypt(dbConfig.apiKeyEnc);
        config = {
          provider: (parsed.data.provider ?? dbConfig.provider) as AiProvider,
          model: parsed.data.model ?? dbConfig.model,
          apiKey,
          baseUrl: parsed.data.baseUrl ?? dbConfig.baseUrl ?? undefined,
        };
      } catch {
        return NextResponse.json(
          { success: false, message: "Fehler beim Entschluesseln des API-Keys." },
          { status: 500 }
        );
      }
    }
  }

  try {
    const provider = createAiProvider(config);
    const result = await provider.testConnection();

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[AI Test] Fehler:", message);

    return NextResponse.json({
      success: false,
      message: message,
    });
  }
}
