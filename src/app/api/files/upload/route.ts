import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { validateFile, saveOriginalFile } from "@/lib/storage";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const { session, error } = await requireAuth();
  if (error) return error;

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const receiptId = formData.get("receiptId") as string | null;

  if (!file) {
    return NextResponse.json({ error: "Keine Datei hochgeladen." }, { status: 400 });
  }

  if (!receiptId) {
    return NextResponse.json({ error: "receiptId ist erforderlich." }, { status: 400 });
  }

  const receipt = await prisma.receipt.findUnique({ where: { id: receiptId } });
  if (!receipt) {
    return NextResponse.json({ error: "Beleg nicht gefunden." }, { status: 404 });
  }

  if (session.role !== "ADMIN" && receipt.userId !== session.userId) {
    return NextResponse.json({ error: "Kein Zugriff auf diesen Beleg." }, { status: 403 });
  }

  const validationError = validateFile(file.type, file.size);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  // Remove existing original file record if replacing
  await prisma.receiptFile.deleteMany({
    where: { receiptId, type: "ORIGINAL" },
  });

  const buffer = Buffer.from(await file.arrayBuffer());

  const stored = await saveOriginalFile(receiptId, buffer, file.type, file.name);

  const receiptFile = await prisma.receiptFile.create({
    data: {
      receiptId,
      type: "ORIGINAL",
      mimeType: stored.mimeType,
      filename: stored.filename,
      storagePath: stored.storagePath,
      sizeBytes: stored.sizeBytes,
    },
  });

  return NextResponse.json(receiptFile, { status: 201 });
}
