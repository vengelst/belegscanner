import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/require-auth";
import { encrypt } from "@/lib/encryption";
import { z } from "zod";
import { AI_PROVIDERS, type AiProvider } from "@/lib/ai/types";

const aiConfigSchema = z.object({
  provider: z.enum(["openai", "anthropic", "google"]),
  model: z.string().min(1, "Modell ist erforderlich."),
  apiKey: z.string().optional(),
  baseUrl: z.string().url("Gueltige URL erforderlich.").nullable().optional(),
  ocrServiceUrl: z.string().url("Gueltige URL erforderlich.").nullable().optional(),
});

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const config = await prisma.aiConfig.findUnique({
    where: { id: "singleton" },
  });

  if (!config) {
    return NextResponse.json({
      provider: "openai",
      model: "gpt-4o-mini",
      hasApiKey: !!process.env.OPENAI_API_KEY,
      baseUrl: null,
      ocrServiceUrl: process.env.OCR_SERVICE_URL ?? "http://ocr-service:8000",
      isEnvFallback: true,
    });
  }

  return NextResponse.json({
    provider: config.provider,
    model: config.model,
    hasApiKey: !!config.apiKeyEnc,
    baseUrl: config.baseUrl,
    ocrServiceUrl: config.ocrServiceUrl,
    updatedAt: config.updatedAt,
    isEnvFallback: false,
  });
}

export async function PUT(request: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungueltiger Request-Body." }, { status: 400 });
  }

  const parsed = aiConfigSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validierungsfehler.", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const provider = parsed.data.provider as AiProvider;
  const availableModels = AI_PROVIDERS[provider].models.map((m) => m.id);
  if (!availableModels.includes(parsed.data.model)) {
    return NextResponse.json(
      { error: `Ungueltiges Modell fuer Provider ${AI_PROVIDERS[provider].name}.` },
      { status: 400 }
    );
  }

  const existing = await prisma.aiConfig.findUnique({
    where: { id: "singleton" },
  });

  let apiKeyEnc = existing?.apiKeyEnc ?? null;
  if (parsed.data.apiKey && parsed.data.apiKey !== "********") {
    apiKeyEnc = encrypt(parsed.data.apiKey);
  }

  const config = await prisma.aiConfig.upsert({
    where: { id: "singleton" },
    update: {
      provider: parsed.data.provider,
      model: parsed.data.model,
      apiKeyEnc: apiKeyEnc,
      baseUrl: parsed.data.baseUrl ?? null,
      ocrServiceUrl: parsed.data.ocrServiceUrl ?? null,
    },
    create: {
      id: "singleton",
      provider: parsed.data.provider,
      model: parsed.data.model,
      apiKeyEnc: apiKeyEnc,
      baseUrl: parsed.data.baseUrl ?? null,
      ocrServiceUrl: parsed.data.ocrServiceUrl ?? null,
    },
  });

  return NextResponse.json({
    provider: config.provider,
    model: config.model,
    hasApiKey: !!config.apiKeyEnc,
    baseUrl: config.baseUrl,
    ocrServiceUrl: config.ocrServiceUrl,
    updatedAt: config.updatedAt,
    isEnvFallback: false,
  });
}
