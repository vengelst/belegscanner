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

  return NextResponse.json({
    totalReceipts,
    totalAmountEur: Number(totals._sum.amountEur ?? 0),
    failedSends,
    foreignCurrencyReceipts,
    byStatus: byStatus.map((s) => ({ status: s.sendStatus, count: s._count })),
    byUser,
    byCountry,
    byPurpose,
    byCategory,
    byCurrency,
  });
}
