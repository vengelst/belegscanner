import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/require-auth";
import { Prisma } from "@prisma/client";
import { getReviewStatusLabel } from "@/lib/receipts/review-status";

export async function GET(request: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const url = request.nextUrl;

  // Reuse same filter logic as receipt list
  const where: Prisma.ReceiptWhereInput = {};

  const search = url.searchParams.get("search")?.trim();
  if (search) {
    where.OR = [
      { supplier: { contains: search, mode: "insensitive" } },
      { remark: { contains: search, mode: "insensitive" } },
      { ocrRawText: { contains: search, mode: "insensitive" } },
    ];
  }

  const sendStatus = url.searchParams.get("sendStatus");
  if (sendStatus) where.sendStatus = { in: sendStatus.split(",").filter(Boolean) as Prisma.EnumSendStatusFilter["in"] };

  const reviewStatus = url.searchParams.get("reviewStatus");
  if (reviewStatus) where.reviewStatus = reviewStatus as Prisma.EnumReviewStatusFilter;

  const purposeId = url.searchParams.get("purposeId");
  if (purposeId) where.purposeId = purposeId;

  const categoryId = url.searchParams.get("categoryId");
  if (categoryId) where.categoryId = categoryId;

  const countryId = url.searchParams.get("countryId");
  if (countryId) where.countryId = countryId;

  const vehicleId = url.searchParams.get("vehicleId");
  if (vehicleId) where.vehicleId = vehicleId;

  const userId = url.searchParams.get("userId");
  if (userId) where.userId = userId;

  const dateFrom = url.searchParams.get("dateFrom");
  const dateTo = url.searchParams.get("dateTo");
  if (dateFrom || dateTo) {
    where.date = {};
    if (dateFrom) where.date.gte = new Date(dateFrom);
    if (dateTo) where.date.lte = new Date(dateTo);
  }

  const receipts = await prisma.receipt.findMany({
    where,
    include: {
      user: { select: { name: true } },
      country: { select: { name: true, code: true } },
      vehicle: { select: { plate: true } },
      purpose: { select: { name: true } },
      category: { select: { name: true } },
    },
    orderBy: { date: "desc" },
    take: 10000,
  });

  // BOM for Excel UTF-8 compatibility
  const BOM = "\uFEFF";
  const SEP = ";";
  const headers = [
    "Datum", "Lieferant", "Betrag", "Waehrung", "EUR-Betrag", "Wechselkurs",
    "Zweck", "Kategorie", "Land", "Kfz", "Benutzer", "Pruefstatus", "Versandstatus",
    "Bemerkung", "Erstellt",
  ];

  const formatDate = (d: Date) => {
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${day}.${month}.${year}`;
  };

  const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;

  const rows = receipts.map((r) => [
    formatDate(r.date),
    esc(r.supplier ?? ""),
    String(Number(r.amount)).replace(".", ","),
    r.currency,
    String(Number(r.amountEur)).replace(".", ","),
    r.exchangeRate ? String(Number(r.exchangeRate)).replace(".", ",") : "",
    esc(r.purpose.name),
    esc(r.category.name),
    esc(r.country?.name ?? ""),
    esc(r.vehicle?.plate ?? ""),
    esc(r.user.name),
    esc(getReviewStatusLabel(r.reviewStatus)),
    r.sendStatus,
    esc((r.remark ?? "").replace(/\n/g, " ")),
    formatDate(r.createdAt),
  ].join(SEP));

  const csv = BOM + headers.join(SEP) + "\n" + rows.join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="belege_export_${new Date().toISOString().split("T")[0]}.csv"`,
    },
  });
}
