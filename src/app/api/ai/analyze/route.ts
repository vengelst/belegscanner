import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { analyzeWithOpenAI } from "@/lib/openai-document-ai";
import { validateFile } from "@/lib/storage";
import { checkRateLimit, cleanupExpiredEntries } from "@/lib/rate-limit";

const RATE_LIMIT_MAX = 30;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

export async function POST(request: NextRequest) {
  let fileMeta: { mimeType: string; sizeBytes: number; fileName: string } | null = null;
  const startedAt = Date.now();

  try {
    const { session, error } = await requireAuth();
    if (error) return error;

    cleanupExpiredEntries(RATE_LIMIT_WINDOW_MS);

    const rateLimit = checkRateLimit(
      `ai-analyze:${session.userId}`,
      RATE_LIMIT_MAX,
      RATE_LIMIT_WINDOW_MS,
    );

    if (!rateLimit.allowed) {
      const resetTime = rateLimit.resetAt.toLocaleTimeString("de-DE", {
        hour: "2-digit",
        minute: "2-digit",
      });
      return NextResponse.json(
        { error: `Analyse-Limit erreicht. Bitte warten Sie bis ${resetTime}.` },
        {
          status: 429,
          headers: {
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": rateLimit.resetAt.toISOString(),
          },
        },
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "Keine Datei hochgeladen." }, { status: 400 });
    }

    fileMeta = {
      mimeType: file.type,
      sizeBytes: file.size,
      fileName: file.name,
    };

    const validationError = validateFile(file.type, file.size);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    console.info("Document analysis request received:", fileMeta);

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await analyzeWithOpenAI(buffer, file.type);

    console.info("Document analysis request completed:", {
      ...fileMeta,
      sourceType: result.sourceType,
      hasRawText: Boolean(result.rawText.trim()),
      durationMs: Date.now() - startedAt,
    });

    if (result.message) {
      console.warn("Document analysis completed with warning:", {
        ...fileMeta,
        durationMs: Date.now() - startedAt,
        message: result.message,
      });
    }

    return NextResponse.json(result, {
      headers: {
        "X-RateLimit-Remaining": String(rateLimit.remaining),
        "X-RateLimit-Reset": rateLimit.resetAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("Document analysis route failed:", {
      ...fileMeta,
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? { name: error.name, message: error.message } : { message: String(error) },
    });
    return NextResponse.json(
      { error: "Die KI-Auslese konnte derzeit nicht ausgefuehrt werden. Bitte Datei pruefen und fehlende Angaben manuell ergaenzen." },
      { status: 500 },
    );
  }
}
