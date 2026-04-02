import { prisma } from "@/lib/prisma";
import { MasterDataManager } from "@/components/admin/master-data-manager";
import type { FieldDef } from "@/components/admin/master-data-manager";

const fields: FieldDef[] = [
  { key: "name", label: "Name", type: "text", required: true, placeholder: "z.B. Tanken" },
  { key: "isHospitality", label: "Bewirtung", type: "checkbox" },
];

export default async function PurposesPage() {
  const items = await prisma.purpose.findMany({ orderBy: { sortOrder: "asc" } });

  return (
    <MasterDataManager
      title="Zwecke"
      description="Belegzwecke pflegen. Bei Bewirtung werden zusaetzliche Pflichtfelder im Beleg aktiviert."
      apiPath="/api/master/purposes"
      fields={fields}
      items={items}
    />
  );
}
