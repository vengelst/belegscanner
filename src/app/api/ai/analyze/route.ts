import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { analyzeWithOpenAI } from "@/lib/openai-document-ai";
import { validateFile } from "@/lib/storage";

export async function POST(request: NextRequest) {
  let fileMeta: { mimeType: string; sizeBytes: number; fileName: string } | null = null;
  const startedAt = Date.now();

  try {
    const { error } = await requireAuth();
    if (error) return error;

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

    return NextResponse.json(result);
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
