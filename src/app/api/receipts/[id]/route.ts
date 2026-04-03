import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/require-auth";
import { receiptUpdateSchema } from "@/lib/validation";
import { Prisma } from "@prisma/client";
import { calculateAmountEur, fetchLatestExchangeRate } from "@/lib/exchange-rates";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireAuth();
  if (error) return error;

  const { id } = await params;

  const receipt = await prisma.receipt.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true, email: true } },
      country: { select: { id: true, name: true, code: true, currencyCode: true } },
      vehicle: { select: { id: true, plate: true, description: true } },
      purpose: { select: { id: true, name: true, isHospitality: true } },
      category: { select: { id: true, name: true } },
      hospitality: true,
      files: true,
      sendLogs: { orderBy: { createdAt: "desc" }, take: 10 },
    },
  });

  if (!receipt) {
    return NextResponse.json({ error: "Beleg nicht gefunden." }, { status: 404 });
  }

  if (session.role !== "ADMIN" && receipt.userId !== session.userId) {
    return NextResponse.json({ error: "Kein Zugriff." }, { status: 403 });
  }

  return NextResponse.json(receipt);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireAuth();
  if (error) return error;

  const { id } = await params;

  const existing = await prisma.receipt.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Beleg nicht gefunden." }, { status: 404 });
  }

  if (session.role !== "ADMIN" && existing.userId !== session.userId) {
    return NextResponse.json({ error: "Kein Zugriff." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungueltiger Request-Body." }, { status: 400 });
  }

  const parsed = receiptUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validierungsfehler.", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const input = parsed.data;
  const data: Record<string, unknown> = {};

  if (input.date !== undefined) data.date = new Date(input.date);
  if (input.supplier !== undefined) data.supplier = input.supplier ?? null;
  if (input.amount !== undefined) data.amount = input.amount;
  if (input.currency !== undefined) data.currency = input.currency;
  if (input.exchangeRate !== undefined) data.exchangeRate = input.exchangeRate ?? null;
  if (input.exchangeRateDate !== undefined) {
    data.exchangeRateDate = input.exchangeRateDate ? new Date(input.exchangeRateDate) : null;
  }
  if (input.countryId !== undefined) data.countryId = input.countryId ?? null;
  if (input.vehicleId !== undefined) data.vehicleId = input.vehicleId ?? null;
  if (input.purposeId !== undefined) data.purposeId = input.purposeId;
  if (input.categoryId !== undefined) data.categoryId = input.categoryId;
  if (input.remark !== undefined) data.remark = input.remark ?? null;
  if (input.aiRawText !== undefined) data.aiRawText = input.aiRawText ?? null;
  if (input.aiDocumentType !== undefined) data.aiDocumentType = input.aiDocumentType ?? null;
  if (input.aiStructuredData !== undefined) data.aiStructuredData = input.aiStructuredData === null ? Prisma.JsonNull : input.aiStructuredData;

  const amount = input.amount ?? Number(existing.amount);
  const currency = input.currency ?? existing.currency;
  let exchangeRate = input.exchangeRate !== undefined
    ? input.exchangeRate ?? null
    : existing.exchangeRate
      ? Number(existing.exchangeRate)
      : null;
  let exchangeRateDate = input.exchangeRateDate !== undefined
    ? input.exchangeRateDate ?? null
    : existing.exchangeRateDate
      ? existing.exchangeRateDate.toISOString().split("T")[0]
      : null;

  if (currency !== "EUR" && (!exchangeRate || exchangeRate <= 0)) {
    try {
      const latestRate = await fetchLatestExchangeRate(currency);
      exchangeRate = latestRate.rate;
      exchangeRateDate = latestRate.rateDate;
      data.exchangeRate = exchangeRate;
      data.exchangeRateDate = new Date(exchangeRateDate);
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Wechselkurs konnte nicht geladen werden." },
        { status: 502 },
      );
    }
  }

  if (currency !== "EUR" && exchangeRate && exchangeRate > 0) {
    data.amountEur = calculateAmountEur(amount, currency, exchangeRate);
  } else if (currency === "EUR") {
    data.amountEur = amount;
    data.exchangeRate = null;
    data.exchangeRateDate = null;
  }

  const effectivePurposeId = input.purposeId ?? existing.purposeId;
  const purpose = await prisma.purpose.findUnique({
    where: { id: effectivePurposeId },
    select: { isHospitality: true },
  });

  if (!purpose) {
    return NextResponse.json({ error: "Zweck nicht gefunden." }, { status: 400 });
  }

  if (input.hospitality !== undefined) {
    const h = input.hospitality;
    if (h && h.occasion.trim() && h.guests.trim() && h.location.trim()) {
      await prisma.hospitality.upsert({
        where: { receiptId: id },
        update: { occasion: h.occasion.trim(), guests: h.guests.trim(), location: h.location.trim() },
        create: { receiptId: id, occasion: h.occasion.trim(), guests: h.guests.trim(), location: h.location.trim() },
      });
    } else if (h === null && !purpose.isHospitality) {
      await prisma.hospitality.deleteMany({ where: { receiptId: id } });
    } else if (purpose.isHospitality) {
      return NextResponse.json(
        { error: "Bewirtungsangaben (Anlass, Gaeste, Ort) sind bei diesem Zweck Pflicht." },
        { status: 400 },
      );
    }
  } else if (purpose.isHospitality && input.purposeId !== undefined) {
    const existingH = await prisma.hospitality.findUnique({ where: { receiptId: id } });
    if (!existingH) {
      return NextResponse.json(
        { error: "Bewirtungsangaben (Anlass, Gaeste, Ort) sind bei diesem Zweck Pflicht." },
        { status: 400 },
      );
    }
  }

  const receipt = await prisma.receipt.update({
    where: { id },
    data,
    include: {
      purpose: { select: { id: true, name: true, isHospitality: true } },
      category: { select: { id: true, name: true } },
      hospitality: true,
      files: true,
    },
  });

  return NextResponse.json(receipt);
}
