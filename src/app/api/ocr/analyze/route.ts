import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { validateFile } from "@/lib/storage";
import { analyzeDocument } from "@/lib/ocr";

export async function POST(request: NextRequest) {
  try {
    const { error } = await requireAuth();
    if (error) return error;

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "Keine Datei hochgeladen." }, { status: 400 });
    }

    const validationError = validateFile(file.type, file.size);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await analyzeDocument(buffer, file.type);

    return NextResponse.json(result);
  } catch (error) {
    console.error("OCR analyze route failed:", error);
    return NextResponse.json(
      { error: "OCR konnte derzeit nicht ausgefuehrt werden. Bitte Datei oder Serverkonfiguration pruefen." },
      { status: 500 },
    );
  }
}
