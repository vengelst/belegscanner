import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { analyzeWithOpenAI, analyzeWithOpenAITextMode } from "@/lib/openai-document-ai";
import { extractTextWithOcrService } from "@/lib/ocr-service";
import { decideTextMode } from "@/lib/ocr-text-mode";
import { validateFile } from "@/lib/storage";
import { checkRateLimit, cleanupExpiredEntries } from "@/lib/rate-limit";
import type { DocumentAnalysisOcrSource } from "@/lib/document-analysis";

const RATE_LIMIT_MAX = 30;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

const IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png"]);

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

    console.info("[Analyze] Request empfangen:", fileMeta);

    const buffer = Buffer.from(await file.arrayBuffer());
    const isImage = IMAGE_MIME_TYPES.has(file.type);
    const isPdf = file.type === "application/pdf";

    let ocrSource: DocumentAnalysisOcrSource;
    let ocrText: string | null = null;

    if (isImage) {
      const ocrStartedAt = Date.now();
      const ocrResult = await extractTextWithOcrService(buffer, file.type);
      const ocrDurationMs = Date.now() - ocrStartedAt;
      const decision = decideTextMode(ocrResult);
      ocrText = ocrResult?.text.trim() || null;

      console.info("[Analyze] Hybrid-Gate:", {
        modus: decision.useTextMode ? "text" : "vision",
        grund: decision.reason,
        confidence: decision.confidence.toFixed(2),
        textLength: decision.textLength,
        lineCount: decision.lineCount,
        hasAmountPattern: decision.hasAmountPattern,
        ocrDurationMs,
      });

      if (decision.useTextMode && ocrText) {
        const openaiStartedAt = Date.now();
        const result = await analyzeWithOpenAITextMode(ocrText, file.type);
        const openaiDurationMs = Date.now() - openaiStartedAt;

        ocrSource = "paddleocr+openai";
        result.ocrSource = ocrSource;

        console.info("[Analyze] Hybrid-Pipeline abgeschlossen:", {
          ...fileMeta,
          ocrSource,
          paddleOcrConfidence: decision.confidence.toFixed(2),
          ocrDurationMs,
          openaiDurationMs,
          totalDurationMs: Date.now() - startedAt,
        });

        return NextResponse.json(result, {
          headers: {
            "X-RateLimit-Remaining": String(rateLimit.remaining),
            "X-RateLimit-Reset": rateLimit.resetAt.toISOString(),
          },
        });
      }
    }

    // Vision-Pfad: Das Modell sieht das Bild selbst. Vorhandener OCR-Text geht
    // als Zusatzkontext mit, damit kleine Positionszeilen doppelt abgesichert sind.
    const openaiStartedAt = Date.now();
    const result = await analyzeWithOpenAI(buffer, file.type, ocrText);
    const openaiDurationMs = Date.now() - openaiStartedAt;

    ocrSource = isPdf ? "openai-pdf" : "openai-vision";
    result.ocrSource = ocrSource;

    console.info("[Analyze] Direkte OpenAI-Analyse abgeschlossen:", {
      ...fileMeta,
      ocrSource,
      sourceType: result.sourceType,
      hasOcrContext: Boolean(ocrText),
      hasRawText: Boolean(result.rawText.trim()),
      partyRole: result.extracted.partyRole,
      supplier: result.extracted.supplier,
      issuerName: result.extracted.issuerName,
      recipientName: result.extracted.recipientName,
      openaiDurationMs,
      totalDurationMs: Date.now() - startedAt,
    });

    if (result.message) {
      console.warn("[Analyze] Warnung:", {
        ...fileMeta,
        totalDurationMs: Date.now() - startedAt,
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
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[Analyze] Fehler:", {
      ...fileMeta,
      totalDurationMs: Date.now() - startedAt,
      error: error instanceof Error ? { name: error.name, message: error.message } : { message: String(error) },
    });

    const isKnownError = errorMessage.includes(":")
      && (errorMessage.includes("API-Key")
        || errorMessage.includes("Guthaben")
        || errorMessage.includes("Rate-Limit")
        || errorMessage.includes("Modell")
        || errorMessage.includes("Provider")
        || errorMessage.includes("Verbindung"));

    return NextResponse.json(
      { error: isKnownError ? errorMessage : "Die KI-Auslese konnte derzeit nicht ausgefuehrt werden. Bitte Datei pruefen und fehlende Angaben manuell ergaenzen." },
      { status: 500 },
    );
  }
}
