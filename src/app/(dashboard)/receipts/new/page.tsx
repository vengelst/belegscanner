import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { ReceiptForm } from "@/components/receipts/receipt-form";
import { connection } from "next/server";

export default async function NewReceiptPage() {
  await connection();
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const [user, purposes, categories, countries, vehicles] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        defaultCountryId: true,
        defaultVehicleId: true,
        defaultPurposeId: true,
        defaultCategoryId: true,
      },
    }),
    prisma.purpose.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
    prisma.category.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
    prisma.country.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
    prisma.vehicle.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
  ]);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-sm font-medium uppercase tracking-[0.24em] text-muted-foreground">
          Erfassung
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">Neuen Beleg anlegen</h1>
      </div>
      <ReceiptForm
        purposes={purposes.map((p) => ({ id: p.id, name: p.name, isHospitality: p.isHospitality }))}
        categories={categories.map((c) => ({ id: c.id, name: c.name }))}
        countries={countries.map((c) => ({ id: c.id, name: c.name, code: c.code, currencyCode: c.currencyCode }))}
        vehicles={vehicles.map((v) => ({ id: v.id, plate: v.plate, description: v.description }))}
        userDefaults={{
          defaultCountryId: user?.defaultCountryId ?? null,
          defaultVehicleId: user?.defaultVehicleId ?? null,
          defaultPurposeId: user?.defaultPurposeId ?? null,
          defaultCategoryId: user?.defaultCategoryId ?? null,
        }}
      />
    </div>
  );
}
