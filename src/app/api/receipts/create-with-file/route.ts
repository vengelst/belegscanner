import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/require-auth";
import { receiptSchema } from "@/lib/validation";
import { validateFile, saveOriginalFile } from "@/lib/storage";
import { calculateAmountEur, fetchLatestExchangeRate } from "@/lib/exchange-rates";
import { Prisma } from "@prisma/client";
import { validateForSend, sendReceipt } from "@/lib/mail";

export async function POST(request: NextRequest) {
  const { session, error } = await requireAuth();
  if (error) return error;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Ungueltiger Request (multipart/form-data erwartet)." }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  const dataRaw = formData.get("data") as string | null;
  const action = (formData.get("action") as string) || "save";

  if (!file) {
    return NextResponse.json({ error: "Keine Datei hochgeladen." }, { status: 400 });
  }

  if (!dataRaw) {
    return NextResponse.json({ error: "Belegdaten (Feld 'data') fehlen." }, { status: 400 });
  }

  // Validate file
  const fileValidationError = validateFile(file.type, file.size);
  if (fileValidationError) {
    return NextResponse.json({ error: fileValidationError }, { status: 400 });
  }

  // Parse and validate receipt data
  let body: unknown;
  try {
    body = JSON.parse(dataRaw);
  } catch {
    return NextResponse.json({ error: "Belegdaten sind kein gueltiges JSON." }, { status: 400 });
  }

  const parsed = receiptSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validierungsfehler.", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const d = parsed.data;

  // Server-side hospitality enforcement
  const purpose = await prisma.purpose.findUnique({
    where: { id: d.purposeId },
    select: { isHospitality: true },
  });
  if (!purpose) {
    return NextResponse.json({ error: "Zweck nicht gefunden." }, { status: 400 });
  }
  if (purpose.isHospitality) {
    const h = d.hospitality;
    if (!h || !h.occasion.trim() || !h.guests.trim() || !h.location.trim()) {
      return NextResponse.json(
        { error: "Bewirtungsangaben (Anlass, Gaeste, Ort) sind bei diesem Zweck Pflicht." },
        { status: 400 },
      );
    }
  }

  // Exchange rate
  let exchangeRate = d.exchangeRate ?? null;
  let exchangeRateDate = d.exchangeRateDate ?? null;

  if (d.currency !== "EUR" && !exchangeRate) {
    try {
      const latestRate = await fetchLatestExchangeRate(d.currency);
      exchangeRate = latestRate.rate;
      exchangeRateDate = latestRate.rateDate;
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Wechselkurs konnte nicht geladen werden." },
        { status: 502 },
      );
    }
  }

  const amountEur = calculateAmountEur(d.amount, d.currency, exchangeRate);

  // Auto-assign default DATEV profile
  const defaultDatev = await prisma.datevProfile.findFirst({
    where: { active: true, isDefault: true },
    select: { id: true },
  }) ?? await prisma.datevProfile.findFirst({
    where: { active: true },
    select: { id: true },
  });

  // Read file buffer before transaction
  const buffer = Buffer.from(await file.arrayBuffer());

  // Atomic transaction: create receipt + file record
  const receipt = await prisma.$transaction(async (tx) => {
    const createdReceipt = await tx.receipt.create({
      data: {
        userId: session.userId,
        date: new Date(d.date),
        supplier: d.supplier ?? null,
        invoiceNumber: d.invoiceNumber ?? null,
        serviceDate: d.serviceDate ? new Date(d.serviceDate) : null,
        dueDate: d.dueDate ? new Date(d.dueDate) : null,
        amount: d.amount,
        currency: d.currency,
        netAmount: d.netAmount ?? null,
        taxAmount: d.taxAmount ?? null,
        exchangeRate: exchangeRate,
        exchangeRateDate: exchangeRateDate ? new Date(exchangeRateDate) : null,
        amountEur,
        countryId: d.countryId ?? null,
        vehicleId: d.vehicleId ?? null,
        purposeId: d.purposeId,
        categoryId: d.categoryId,
        datevProfileId: defaultDatev?.id ?? null,
        remark: d.remark ?? null,
        aiRawText: d.aiRawText ?? null,
        aiDocumentType: d.aiDocumentType ?? null,
        aiStructuredData: d.aiStructuredData === undefined ? undefined : d.aiStructuredData === null ? Prisma.JsonNull : d.aiStructuredData,
        sendStatus: "OPEN",
        ...(d.hospitality ? {
          hospitality: {
            create: {
              occasion: d.hospitality.occasion,
              guests: d.hospitality.guests,
              location: d.hospitality.location,
            },
          },
        } : {}),
      },
    });

    // Save file to disk
    const stored = await saveOriginalFile(createdReceipt.id, buffer, file.type, file.name);

    // Create file record in DB
    await tx.receiptFile.create({
      data: {
        receiptId: createdReceipt.id,
        type: "ORIGINAL",
        mimeType: stored.mimeType,
        filename: stored.filename,
        storagePath: stored.storagePath,
        sizeBytes: stored.sizeBytes,
      },
    });

    return createdReceipt;
  });

  // Reload with relations for consistent response
  const fullReceipt = await prisma.receipt.findUnique({
    where: { id: receipt.id },
    include: {
      purpose: { select: { id: true, name: true, isHospitality: true } },
      category: { select: { id: true, name: true } },
      hospitality: true,
      files: { where: { type: "ORIGINAL" }, select: { id: true, mimeType: true }, take: 1 },
    },
  });

  // Optional: trigger send
  if (action === "send") {
    const validationErrors = await validateForSend(receipt.id);
    if (validationErrors.length > 0) {
      return NextResponse.json(
        {
          receipt: fullReceipt,
          sendError: "Versandvoraussetzungen nicht erfuellt.",
          sendDetails: validationErrors,
        },
        { status: 201 },
      );
    }

    await prisma.receipt.update({
      where: { id: receipt.id },
      data: { sendStatus: "READY", sendStatusUpdatedAt: new Date() },
    });

    const result = await sendReceipt(receipt.id);
    if (!result.success) {
      return NextResponse.json(
        {
          receipt: fullReceipt,
          sendError: result.errorMessage ?? "Versand fehlgeschlagen.",
        },
        { status: 201 },
      );
    }
  }

  return NextResponse.json({ receipt: fullReceipt }, { status: 201 });
}
