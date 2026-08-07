import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ReceiptEditForm } from "@/components/receipts/receipt-edit-form";
import { parseStructuredData } from "@/components/receipts/detail/parse-structured-data";
import { connection } from "next/server";
import { getCompanyCardLastDigits } from "@/lib/organization";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function EditReceiptPage({ params }: Props) {
  await connection();
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { id } = await params;

  const receipt = await prisma.receipt.findUnique({
    where: { id },
    include: {
      purpose: { select: { id: true, name: true, isHospitality: true } },
      hospitality: true,
      files: { where: { type: "ORIGINAL" }, select: { id: true }, take: 1 },
    },
  });

  if (!receipt || receipt.deletedAt) notFound();

  if (session.user.role !== "ADMIN" && receipt.userId !== session.user.id) {
    notFound();
  }

  const [purposes, countries, vehicles, companyCardLastDigits] = await Promise.all([
    prisma.purpose.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
    prisma.country.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
    prisma.vehicle.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
    getCompanyCardLastDigits(),
  ]);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-sm font-medium uppercase tracking-[0.24em] text-muted-foreground">
          Bearbeitung
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">Beleg bearbeiten</h1>
      </div>
      <ReceiptEditForm
        receipt={{
          id: receipt.id,
          date: receipt.date.toISOString().split("T")[0],
          partyRole: receipt.partyRole,
          supplier: receipt.supplier,
          invoiceNumber: receipt.invoiceNumber,
          serviceDate: receipt.serviceDate?.toISOString().split("T")[0] ?? null,
          dueDate: receipt.dueDate?.toISOString().split("T")[0] ?? null,
          amount: Number(receipt.amount),
          currency: receipt.currency,
          netAmount: receipt.netAmount != null ? Number(receipt.netAmount) : null,
          taxAmount: receipt.taxAmount != null ? Number(receipt.taxAmount) : null,
          reverseCharge: receipt.reverseCharge,
          vatRatePercent: receipt.vatRatePercent != null ? Number(receipt.vatRatePercent) : null,
          exchangeRate: receipt.exchangeRate ? Number(receipt.exchangeRate) : null,
          exchangeRateDate: receipt.exchangeRateDate?.toISOString().split("T")[0] ?? null,
          countryId: receipt.countryId,
          vehicleId: receipt.vehicleId,
          purposeId: receipt.purposeId,
          datevBelegtyp: receipt.datevBelegtyp,
          aiDocumentType: receipt.aiDocumentType,
          remark: receipt.remark,
          hospitality: receipt.hospitality ? {
            occasion: receipt.hospitality.occasion,
            guests: receipt.hospitality.guests,
            location: receipt.hospitality.location,
          } : null,
        }}
        structuredData={parseStructuredData(receipt.aiStructuredData)}
        hasOriginalFile={receipt.files.length > 0}
        purposes={purposes.map((p) => ({ id: p.id, name: p.name, isHospitality: p.isHospitality }))}
        countries={countries.map((c) => ({
          id: c.id,
          name: c.name,
          code: c.code,
          currencyCode: c.currencyCode,
          vatRatePercent: c.vatRatePercent != null ? Number(c.vatRatePercent) : null,
        }))}
        vehicles={vehicles.map((v) => ({ id: v.id, plate: v.plate, description: v.description }))}
        companyCardLastDigits={companyCardLastDigits}
      />
    </div>
  );
}
