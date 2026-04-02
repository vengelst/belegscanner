import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/require-auth";
import { receiptSchema } from "@/lib/validation";
import { Prisma } from "@prisma/client";

export async function GET(request: NextRequest) {
  const { session, error } = await requireAuth();
  if (error) return error;

  const url = request.nextUrl;
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
  const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get("pageSize") ?? 20)));

  const where: Prisma.ReceiptWhereInput = {};

  // Users only see their own receipts
  if (session.role !== "ADMIN") {
    where.userId = session.userId;
  } else {
    const userId = url.searchParams.get("userId");
    if (userId) where.userId = userId;
  }

  // Fulltext search across supplier, remark, ocrRawText
  const search = url.searchParams.get("search")?.trim();
  if (search) {
    where.OR = [
      { supplier: { contains: search, mode: "insensitive" } },
      { remark: { contains: search, mode: "insensitive" } },
      { ocrRawText: { contains: search, mode: "insensitive" } },
    ];
  }

  const sendStatus = url.searchParams.get("sendStatus");
  if (sendStatus) {
    const statuses = sendStatus.split(",").filter(Boolean);
    if (statuses.length > 0) {
      where.sendStatus = { in: statuses as Prisma.EnumSendStatusFilter["in"] };
    }
  }

  const reviewStatus = url.searchParams.get("reviewStatus");
  if (reviewStatus) {
    where.reviewStatus = reviewStatus as Prisma.EnumReviewStatusFilter;
  }

  const purposeId = url.searchParams.get("purposeId");
  if (purposeId) where.purposeId = purposeId;

  const categoryId = url.searchParams.get("categoryId");
  if (categoryId) where.categoryId = categoryId;

  const countryId = url.searchParams.get("countryId");
  if (countryId) where.countryId = countryId;

  const vehicleId = url.searchParams.get("vehicleId");
  if (vehicleId) where.vehicleId = vehicleId;

  const dateFrom = url.searchParams.get("dateFrom");
  const dateTo = url.searchParams.get("dateTo");
  if (dateFrom || dateTo) {
    where.date = {};
    if (dateFrom) where.date.gte = new Date(dateFrom);
    if (dateTo) where.date.lte = new Date(dateTo);
  }

  const [receipts, total] = await Promise.all([
    prisma.receipt.findMany({
      where,
      include: {
        user: { select: { id: true, name: true } },
        country: { select: { id: true, name: true, code: true } },
        vehicle: { select: { id: true, plate: true } },
        purpose: { select: { id: true, name: true, isHospitality: true } },
        category: { select: { id: true, name: true } },
        hospitality: { select: { id: true } },
        files: { where: { type: "ORIGINAL" }, select: { id: true, mimeType: true }, take: 1 },
      },
      orderBy: { date: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.receipt.count({ where }),
  ]);

  return NextResponse.json({
    data: receipts,
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  });
}

export async function POST(request: NextRequest) {
  const { session, error } = await requireAuth();
  if (error) return error;

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Ungueltiger Request-Body." }, { status: 400 });
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

  let amountEur = d.amount;
  if (d.currency !== "EUR" && d.exchangeRate) {
    amountEur = Math.round((d.amount / d.exchangeRate) * 100) / 100;
  }

  const receipt = await prisma.receipt.create({
    data: {
      userId: session.userId,
      date: new Date(d.date),
      supplier: d.supplier ?? null,
      amount: d.amount,
      currency: d.currency,
      exchangeRate: d.exchangeRate ?? null,
      exchangeRateDate: d.exchangeRateDate ? new Date(d.exchangeRateDate) : null,
      amountEur,
      countryId: d.countryId ?? null,
      vehicleId: d.vehicleId ?? null,
      purposeId: d.purposeId,
      categoryId: d.categoryId,
      remark: d.remark ?? null,
      ocrRawText: d.ocrRawText ?? null,
      detectedDocumentType: d.detectedDocumentType ?? null,
      ocrStructuredData: d.ocrStructuredData === undefined ? undefined : d.ocrStructuredData === null ? Prisma.JsonNull : d.ocrStructuredData,
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
    include: {
      purpose: { select: { id: true, name: true, isHospitality: true } },
      category: { select: { id: true, name: true } },
      hospitality: true,
    },
  });

  return NextResponse.json(receipt, { status: 201 });
}
