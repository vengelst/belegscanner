import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ReceiptPrintView } from "@/components/receipts/receipt-print-view";
import { connection } from "next/server";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function PrintReceiptPage({ params }: Props) {
  await connection();
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { id } = await params;

  const receipt = await prisma.receipt.findUnique({
    where: { id },
    include: {
      user: { select: { name: true } },
      country: { select: { name: true, code: true } },
      vehicle: { select: { plate: true } },
      purpose: { select: { name: true, isHospitality: true } },
      category: { select: { name: true } },
      hospitality: true,
      files: { where: { type: "ORIGINAL" }, take: 1 },
    },
  });

  if (!receipt) notFound();

  if (session.user.role !== "ADMIN" && receipt.userId !== session.user.id) {
    notFound();
  }

  const originalFile = receipt.files[0] ?? null;

  return (
    <ReceiptPrintView
      receipt={{
        id: receipt.id,
        date: receipt.date.toISOString(),
        supplier: receipt.supplier,
        amount: Number(receipt.amount),
        currency: receipt.currency,
        exchangeRate: receipt.exchangeRate ? Number(receipt.exchangeRate) : null,
        exchangeRateDate: receipt.exchangeRateDate?.toISOString() ?? null,
        amountEur: Number(receipt.amountEur),
        sendStatus: receipt.sendStatus,
        sendStatusUpdatedAt: receipt.sendStatusUpdatedAt?.toISOString() ?? null,
        userName: receipt.user.name,
        purposeName: receipt.purpose.name,
        categoryName: receipt.category.name,
        countryName: receipt.country?.name ?? null,
        countryCode: receipt.country?.code ?? null,
        vehiclePlate: receipt.vehicle?.plate ?? null,
        remark: receipt.remark,
        createdAt: receipt.createdAt.toISOString(),
        hospitality: receipt.hospitality
          ? {
              occasion: receipt.hospitality.occasion,
              guests: receipt.hospitality.guests,
              location: receipt.hospitality.location,
            }
          : null,
        file: originalFile
          ? {
              id: originalFile.id,
              mimeType: originalFile.mimeType,
              filename: originalFile.filename,
            }
          : null,
      }}
    />
  );
}
