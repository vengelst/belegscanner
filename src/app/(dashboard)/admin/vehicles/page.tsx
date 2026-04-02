import { prisma } from "@/lib/prisma";
import { MasterDataManager } from "@/components/admin/master-data-manager";
import type { FieldDef } from "@/components/admin/master-data-manager";

const fields: FieldDef[] = [
  { key: "plate", label: "Kennzeichen", type: "text", required: true, placeholder: "z.B. B-AB 1234" },
  { key: "description", label: "Bezeichnung", type: "text", placeholder: "z.B. Firmenwagen" },
];

export default async function VehiclesPage() {
  const items = await prisma.vehicle.findMany({ orderBy: { sortOrder: "asc" } });

  return (
    <MasterDataManager
      title="Kfz-Kennzeichen"
      description="Fahrzeuge mit Kennzeichen und optionaler Bezeichnung pflegen."
      apiPath="/api/master/vehicles"
      fields={fields}
      items={items.map((i) => ({ ...i, description: i.description ?? "" }))}
    />
  );
}
