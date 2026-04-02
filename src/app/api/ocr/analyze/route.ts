import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { validateFile } from "@/lib/storage";
import ocrModule from "@/lib/ocr";

export async function POST(request: NextRequest) {
  let fileMeta: { mimeType: string; sizeBytes: number; fileName: string } | null = null;

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

    const buffer = Buffer.from(await file.arrayBuffer());
    const { analyzeDocument } = ocrModule as { analyzeDocument: (buffer: Buffer, mimeType: string) => Promise<unknown> };
    const result = await analyzeDocument(buffer, file.type);

    if (result.message) {
      console.warn("OCR analyze completed with warning:", {
        ...fileMeta,
        sourceType: result.sourceType,
        hasRawText: Boolean(result.rawText.trim()),
        message: result.message,
      });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("OCR analyze route failed:", {
      ...fileMeta,
      error: error instanceof Error ? { name: error.name, message: error.message } : { message: String(error) },
    });
    return NextResponse.json(
      { error: "OCR konnte derzeit nicht ausgefuehrt werden. Bitte Datei oder Serverkonfiguration pruefen." },
      { status: 500 },
    );
  }
}
