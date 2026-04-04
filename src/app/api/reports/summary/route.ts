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

  const dateConditions: Prisma.Sql[] = [];
  if (dateFrom) dateConditions.push(Prisma.sql`date >= ${new Date(dateFrom)}`);
  if (dateTo) dateConditions.push(Prisma.sql`date <= ${new Date(dateTo)}`);
  const rawWhere = dateConditions.length > 0
    ? Prisma.sql`WHERE ${Prisma.join(dateConditions, " AND ")}`
    : Prisma.empty;

  const [
    totalReceipts,
    byStatus,
    byUser,
    byCountry,
    byPurpose,
    byCurrency,
    foreignCurrencyReceipts,
    totals,
    paymentMethodReceipts,
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

    prisma.receipt.findMany({
      where,
      select: {
        amountEur: true,
        aiStructuredData: true,
      },
    }),
  ]);

  const failedSends = await prisma.sendLog.count({
    where: { success: false, ...(dateFrom || dateTo ? { createdAt: { ...(dateFrom ? { gte: new Date(dateFrom) } : {}), ...(dateTo ? { lte: new Date(dateTo) } : {}) } } : {}) },
  });

  // --- Time breakdowns (database-level aggregation) ---
  const byDayRaw: Array<{ day: string; week_start: string; count: bigint; sum_eur: Prisma.Decimal | null }> = await prisma.$queryRaw(
    Prisma.sql`
      SELECT
        to_char(date, 'YYYY-MM-DD') AS day,
        to_char(date_trunc('week', date), 'YYYY-MM-DD') AS week_start,
        COUNT(*)::bigint AS count,
        SUM("amountEur") AS sum_eur
      FROM "Receipt"
      ${rawWhere}
      GROUP BY to_char(date, 'YYYY-MM-DD'), date_trunc('week', date)
      ORDER BY day ASC
    `,
  );
  const byWeekRaw: Array<{ week_start: string; week_label: string; count: bigint; sum_eur: Prisma.Decimal | null }> = await prisma.$queryRaw(
    Prisma.sql`
      SELECT
        to_char(date_trunc('week', date), 'YYYY-MM-DD') AS week_start,
        to_char(date_trunc('week', date), 'IYYY') || '-KW' || to_char(date_trunc('week', date), 'IW') AS week_label,
        COUNT(*)::bigint AS count,
        SUM("amountEur") AS sum_eur
      FROM "Receipt"
      ${rawWhere}
      GROUP BY date_trunc('week', date)
      ORDER BY date_trunc('week', date) ASC
    `,
  );
  const byMonthRaw: Array<{ month: string; count: bigint; sum_eur: Prisma.Decimal | null }> = await prisma.$queryRaw(
    Prisma.sql`
      SELECT to_char(date, 'YYYY-MM') AS month, COUNT(*)::bigint AS count, SUM("amountEur") AS sum_eur
      FROM "Receipt"
      ${rawWhere}
      GROUP BY to_char(date, 'YYYY-MM')
      ORDER BY month ASC
    `,
  );
  const byDay = byDayRaw.map((r) => ({
    day: r.day,
    weekStart: r.week_start,
    count: Number(r.count),
    sumEur: Number(r.sum_eur ?? 0),
  }));
  const byWeek = byWeekRaw.map((r) => ({
    weekStart: r.week_start,
    weekLabel: r.week_label,
    count: Number(r.count),
    sumEur: Number(r.sum_eur ?? 0),
  }));
  const byMonth = byMonthRaw.map((r) => ({
    month: r.month,
    count: Number(r.count),
    sumEur: Number(r.sum_eur ?? 0),
  }));

  const paymentMethodMap = new Map<string, { name: string; count: number; sumEur: number }>();
  for (const receipt of paymentMethodReceipts) {
    const method = extractPaymentMethod(receipt.aiStructuredData);
    const label = paymentMethodLabel(method);
    const current = paymentMethodMap.get(label) ?? { name: label, count: 0, sumEur: 0 };
    current.count += 1;
    current.sumEur += Number(receipt.amountEur ?? 0);
    paymentMethodMap.set(label, current);
  }
  const byPaymentMethod = Array.from(paymentMethodMap.values())
    .map((item) => ({ ...item, sumEur: Number(item.sumEur.toFixed(2)) }))
    .sort((a, b) => b.count - a.count);

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
    byDay,
    byWeek,
    byMonth,
    byUser,
    byCountry,
    byPurpose,
    byPaymentMethod,
    byCurrency,
    problems,
  });
}

function extractPaymentMethod(value: Prisma.JsonValue | null): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const extracted = "extracted" in value ? value.extracted : null;
  if (!extracted || typeof extracted !== "object" || Array.isArray(extracted)) return null;
  const paymentMethod = "paymentMethod" in extracted ? extracted.paymentMethod : null;
  return typeof paymentMethod === "string" ? paymentMethod : null;
}

function paymentMethodLabel(method: string | null): string {
  switch (method) {
    case "cash":
      return "Barzahlung";
    case "visa":
      return "Visa";
    case "mastercard":
      return "Mastercard";
    case "credit_card":
      return "Kreditkarte";
    case "debit_card":
      return "Debitkarte";
    case "paypal":
      return "PayPal";
    case "sepa":
      return "SEPA-Lastschrift";
    case "bank_transfer":
      return "Ueberweisung";
    case "unknown":
      return "Unklare Kartenzahlung";
    default:
      return "Nicht erkannt";
  }
}
