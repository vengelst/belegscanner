import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { ReceiptListPage } from "@/components/receipts/receipt-list-page";
import { Prisma } from "@prisma/client";
import { connection } from "next/server";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ReceiptsPage({ searchParams }: Props) {
  await connection();
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const sp = await searchParams;
  const isAdmin = session.user.role === "ADMIN";

  // Parse query params
  const page = Math.max(1, Number(sp.page ?? 1));
  const pageSize = 20;
  const search = typeof sp.search === "string" ? sp.search.trim() : "";
  const sendStatus = typeof sp.sendStatus === "string" ? sp.sendStatus : "";
  const purposeId = typeof sp.purposeId === "string" ? sp.purposeId : "";
  const categoryId = typeof sp.categoryId === "string" ? sp.categoryId : "";
  const countryId = typeof sp.countryId === "string" ? sp.countryId : "";
  const vehicleId = typeof sp.vehicleId === "string" ? sp.vehicleId : "";
  const userId = typeof sp.userId === "string" ? sp.userId : "";
  const dateFrom = typeof sp.dateFrom === "string" ? sp.dateFrom : "";
  const dateTo = typeof sp.dateTo === "string" ? sp.dateTo : "";
  const reviewStatus = typeof sp.reviewStatus === "string" ? sp.reviewStatus : "";

  // Build where clause
  const where: Prisma.ReceiptWhereInput = {};
  if (!isAdmin) {
    where.userId = session.user.id;
  } else if (userId) {
    where.userId = userId;
  }

  if (search) {
    where.OR = [
      { supplier: { contains: search, mode: "insensitive" } },
      { remark: { contains: search, mode: "insensitive" } },
      { ocrRawText: { contains: search, mode: "insensitive" } },
    ];
  }

  if (sendStatus) {
    const statuses = sendStatus.split(",").filter(Boolean);
    if (statuses.length > 0) {
      where.sendStatus = { in: statuses as Prisma.EnumSendStatusFilter["in"] };
    }
  }

  if (reviewStatus) {
    where.reviewStatus = reviewStatus as Prisma.EnumReviewStatusFilter;
  }

  if (purposeId) where.purposeId = purposeId;
  if (categoryId) where.categoryId = categoryId;
  if (countryId) where.countryId = countryId;
  if (vehicleId) where.vehicleId = vehicleId;

  if (dateFrom || dateTo) {
    where.date = {};
    if (dateFrom) where.date.gte = new Date(dateFrom);
    if (dateTo) where.date.lte = new Date(dateTo);
  }

  // Load data
  const [receipts, total, purposes, categories, countries, vehicles, users] = await Promise.all([
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
    prisma.purpose.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
    prisma.category.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
    prisma.country.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true, code: true } }),
    prisma.vehicle.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" }, select: { id: true, plate: true } }),
    isAdmin ? prisma.user.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }) : [],
  ]);

  const mapped = receipts.map((r) => ({
    id: r.id,
    date: r.date.toISOString(),
    supplier: r.supplier,
    amount: Number(r.amount),
    currency: r.currency,
    amountEur: Number(r.amountEur),
    sendStatus: r.sendStatus,
    reviewStatus: r.reviewStatus,
    sendStatusUpdatedAt: r.sendStatusUpdatedAt?.toISOString() ?? null,
    userName: r.user.name,
    purposeName: r.purpose.name,
    isHospitality: r.purpose.isHospitality,
    hasHospitality: !!r.hospitality,
    categoryName: r.category.name,
    countryName: r.country?.name ?? null,
    vehiclePlate: r.vehicle?.plate ?? null,
    hasFile: r.files.length > 0,
    fileId: r.files[0]?.id ?? null,
    fileMimeType: r.files[0]?.mimeType ?? null,
    createdAt: r.createdAt.toISOString(),
  }));

  return (
    <ReceiptListPage
      receipts={mapped}
      pagination={{ page, pageSize, total, totalPages: Math.ceil(total / pageSize) }}
      filters={{ search, sendStatus, reviewStatus, purposeId, categoryId, countryId, vehicleId, userId, dateFrom, dateTo }}
      filterOptions={{
        purposes: purposes,
        categories: categories,
        countries: countries.map((c) => ({ id: c.id, label: `${c.name}${c.code ? ` (${c.code})` : ""}` })),
        vehicles: vehicles.map((v) => ({ id: v.id, label: v.plate })),
        users: users.map((u) => ({ id: u.id, label: u.name })),
      }}
      isAdmin={isAdmin}
    />
  );
}
