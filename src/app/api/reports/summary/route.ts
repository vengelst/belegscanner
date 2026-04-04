import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/require-auth";
import { Prisma } from "@prisma/client";

export async function GET(request: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const url = request.nextUrl;
  const dateFrom = url.searchParams.get("dateFrom");
  const dateTo = url.searchParams.get("dateTo");

  const where: Prisma.ReceiptWhereInput = {};
  if (dateFrom || dateTo) {
    where.date = {};
    if (dateFrom) where.date.gte = new Date(dateFrom);
    if (dateTo) where.date.lte = new Date(dateTo);
  }

  const [
    totalReceipts,
    byStatus,
    byUser,
    byCountry,
    byPurpose,
    byCategory,
    byCurrency,
    foreignCurrencyReceipts,
    totals,
  ] = await Promise.all([
    prisma.receipt.count({ where }),

    prisma.receipt.groupBy({
      by: ["sendStatus"],
      where,
      _count: true,
    }),

    prisma.receipt.groupBy({
      by: ["userId"],
      where,
      _count: true,
      _sum: { amountEur: true },
    }).then(async (groups) => {
      const userIds = groups.map((g) => g.userId);
      const users = await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true },
      });
      const userMap = new Map(users.map((u) => [u.id, u.name]));
      return groups.map((g) => ({
        userId: g.userId,
        userName: userMap.get(g.userId) ?? "Unbekannt",
        count: g._count,
        sumEur: Number(g._sum.amountEur ?? 0),
      })).sort((a, b) => b.count - a.count);
    }),

    prisma.receipt.groupBy({
      by: ["countryId"],
      where: { ...where, countryId: { not: null } },
      _count: true,
      _sum: { amountEur: true },
    }).then(async (groups) => {
      const ids = groups.map((g) => g.countryId!);
      const countries = await prisma.country.findMany({
        where: { id: { in: ids } },
        select: { id: true, name: true },
      });
      const map = new Map(countries.map((c) => [c.id, c.name]));
      return groups.map((g) => ({
        name: map.get(g.countryId!) ?? "Unbekannt",
        count: g._count,
        sumEur: Number(g._sum.amountEur ?? 0),
      })).sort((a, b) => b.count - a.count);
    }),

    prisma.receipt.groupBy({
      by: ["purposeId"],
      where,
      _count: true,
      _sum: { amountEur: true },
    }).then(async (groups) => {
      const ids = groups.map((g) => g.purposeId);
      const purposes = await prisma.purpose.findMany({
        where: { id: { in: ids } },
        select: { id: true, name: true },
      });
      const map = new Map(purposes.map((p) => [p.id, p.name]));
      return groups.map((g) => ({
        name: map.get(g.purposeId) ?? "Unbekannt",
        count: g._count,
        sumEur: Number(g._sum.amountEur ?? 0),
      })).sort((a, b) => b.count - a.count);
    }),

    prisma.receipt.groupBy({
      by: ["categoryId"],
      where,
      _count: true,
      _sum: { amountEur: true },
    }).then(async (groups) => {
      const ids = groups.map((g) => g.categoryId);
      const categories = await prisma.category.findMany({
        where: { id: { in: ids } },
        select: { id: true, name: true },
      });
      const map = new Map(categories.map((c) => [c.id, c.name]));
      return groups.map((g) => ({
        name: map.get(g.categoryId) ?? "Unbekannt",
        count: g._count,
        sumEur: Number(g._sum.amountEur ?? 0),
      })).sort((a, b) => b.count - a.count);
    }),

    prisma.receipt.groupBy({
      by: ["currency"],
      where,
      _count: true,
      _sum: { amount: true },
    }).then((groups) => groups
      .map((g) => ({
        currency: g.currency,
        count: g._count,
        sumOriginal: Number(g._sum.amount ?? 0),
      }))
      .sort((a, b) => b.count - a.count)),

    prisma.receipt.count({
      where: { ...where, currency: { not: "EUR" } },
    }),

    prisma.receipt.aggregate({
      where,
      _sum: { amountEur: true },
      _count: true,
    }),
  ]);

  const failedSends = await prisma.sendLog.count({
    where: { success: false, ...(dateFrom || dateTo ? { createdAt: { ...(dateFrom ? { gte: new Date(dateFrom) } : {}), ...(dateTo ? { lte: new Date(dateTo) } : {}) } } : {}) },
  });

  // --- Monthly breakdown (database-level aggregation via raw SQL) ---
  const dateFilter = dateFrom || dateTo
    ? `WHERE ${[dateFrom ? `date >= '${dateFrom}'` : "", dateTo ? `date <= '${dateTo}'` : ""].filter(Boolean).join(" AND ")}`
    : "";
  const byMonthRaw: Array<{ month: string; count: bigint; sum_eur: Prisma.Decimal | null }> = await prisma.$queryRawUnsafe(
    `SELECT to_char(date, 'YYYY-MM') AS month, COUNT(*)::bigint AS count, SUM("amountEur") AS sum_eur
     FROM "Receipt" ${dateFilter}
     GROUP BY to_char(date, 'YYYY-MM')
     ORDER BY month ASC`,
  );
  const byMonth = byMonthRaw.map((r) => ({
    month: r.month,
    count: Number(r.count),
    sumEur: Number(r.sum_eur ?? 0),
  }));

  // --- Review status breakdown ---
  const byReviewStatus = await prisma.receipt.groupBy({
    by: ["reviewStatus"],
    where,
    _count: true,
  });

  // --- Problematic receipts (only operationally open — not yet successfully sent) ---
  // SENT receipts are done; their missing fields are historical, not actionable.
  const openWhere: Prisma.ReceiptWhereInput = {
    ...where,
    sendStatus: { not: "SENT" },
  };

  const [
    missingFile,
    missingCountry,
    missingSupplier,
    missingExchangeRate,
    sendFailed,
    missingHospitality,
  ] = await Promise.all([
    prisma.receipt.count({
      where: { ...openWhere, files: { none: { type: "ORIGINAL" } } },
    }),
    prisma.receipt.count({
      where: { ...openWhere, countryId: null },
    }),
    prisma.receipt.count({
      where: { ...openWhere, OR: [{ supplier: null }, { supplier: "" }] },
    }),
    prisma.receipt.count({
      where: { ...openWhere, currency: { not: "EUR" }, exchangeRate: null },
    }),
    prisma.receipt.count({
      where: { ...where, sendStatus: "FAILED" },
    }),
    prisma.receipt.count({
      where: {
        ...openWhere,
        purpose: { isHospitality: true },
        hospitality: null,
      },
    }),
  ]);

  // Distinct count: how many unique receipts have at least one problem?
  const distinctProblematic = await prisma.receipt.count({
    where: {
      ...openWhere,
      OR: [
        { files: { none: { type: "ORIGINAL" } } },
        { countryId: null },
        { OR: [{ supplier: null }, { supplier: "" }] },
        { currency: { not: "EUR" }, exchangeRate: null },
        { sendStatus: "FAILED" },
        { purpose: { isHospitality: true }, hospitality: null },
      ],
    },
  });

  const problems = {
    missingFile,
    missingCountry,
    missingSupplier,
    missingExchangeRate,
    sendFailed,
    missingHospitality,
    total: distinctProblematic,
  };

  return NextResponse.json({
    totalReceipts,
    totalAmountEur: Number(totals._sum.amountEur ?? 0),
    failedSends,
    foreignCurrencyReceipts,
    byStatus: byStatus.map((s) => ({ status: s.sendStatus, count: s._count })),
    byReviewStatus: byReviewStatus.map((s) => ({ status: s.reviewStatus, count: s._count })),
    byMonth,
    byUser,
    byCountry,
    byPurpose,
    byCategory,
    byCurrency,
    problems,
  });
}
