import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { analyzeWithOpenAI, analyzeWithOpenAITextMode } from "@/lib/openai-document-ai";
import { extractTextWithOcrService } from "@/lib/ocr-service";
import { validateFile } from "@/lib/storage";
import { checkRateLimit, cleanupExpiredEntries } from "@/lib/rate-limit";
import type { DocumentAnalysisOcrSource } from "@/lib/document-analysis";

const RATE_LIMIT_MAX = 30;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

const IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png"]);
const PADDLEOCR_CONFIDENCE_THRESHOLD = 0.5;

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

    if (isImage) {
      const ocrStartedAt = Date.now();
      const ocrResult = await extractTextWithOcrService(buffer, file.type);
      const ocrDurationMs = Date.now() - ocrStartedAt;

      if (ocrResult && ocrResult.text.trim().length > 0 && ocrResult.confidence > PADDLEOCR_CONFIDENCE_THRESHOLD) {
        console.info("[Analyze] PaddleOCR erfolgreich:", {
          textLength: ocrResult.text.length,
          confidence: ocrResult.confidence.toFixed(2),
          ocrDurationMs,
        });

        const openaiStartedAt = Date.now();
        const result = await analyzeWithOpenAITextMode(ocrResult.text, file.type);
        const openaiDurationMs = Date.now() - openaiStartedAt;

        ocrSource = "paddleocr+openai";
        result.ocrSource = ocrSource;

        console.info("[Analyze] Hybrid-Pipeline abgeschlossen:", {
          ...fileMeta,
          ocrSource,
          paddleOcrConfidence: ocrResult.confidence.toFixed(2),
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

      if (ocrResult) {
        console.info("[Analyze] PaddleOCR-Confidence zu niedrig:", {
          confidence: ocrResult.confidence.toFixed(2),
          threshold: PADDLEOCR_CONFIDENCE_THRESHOLD,
          ocrDurationMs,
        });
      } else {
        console.info("[Analyze] PaddleOCR nicht verfuegbar, ocrDurationMs:", ocrDurationMs);
      }
    }

    const openaiStartedAt = Date.now();
    const result = await analyzeWithOpenAI(buffer, file.type);
    const openaiDurationMs = Date.now() - openaiStartedAt;

    ocrSource = isPdf ? "openai-pdf" : "openai-vision";
    result.ocrSource = ocrSource;

    console.info("[Analyze] Direkte OpenAI-Analyse abgeschlossen:", {
      ...fileMeta,
      ocrSource,
      sourceType: result.sourceType,
      hasRawText: Boolean(result.rawText.trim()),
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
    console.error("[Analyze] Fehler:", {
      ...fileMeta,
      totalDurationMs: Date.now() - startedAt,
      error: error instanceof Error ? { name: error.name, message: error.message } : { message: String(error) },
    });
    return NextResponse.json(
      { error: "Die KI-Auslese konnte derzeit nicht ausgefuehrt werden. Bitte Datei pruefen und fehlende Angaben manuell ergaenzen." },
      { status: 500 },
    );
  }
}
