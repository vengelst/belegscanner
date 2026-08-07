import { prisma } from "@/lib/prisma";
import { MasterDataManager } from "@/components/admin/master-data-manager";
import type { FieldDef } from "@/components/admin/master-data-manager";

const fields: FieldDef[] = [
  { key: "name", label: "Name", type: "text", required: true, placeholder: "z.B. Kreditkarte" },
];

export default async function CategoriesPage() {
  const items = await prisma.category.findMany({ orderBy: { sortOrder: "asc" } });

  return (
    <MasterDataManager
      title="Kategorien (veraltet)"
      description="Veraltet: Kategorien werden in der Erfassung nicht mehr abgefragt. Belege werden ueber den DATEV-Belegtyp gesteuert. Diese Seite bleibt nur fuer Altdaten erreichbar."
      apiPath="/api/master/categories"
      fields={fields}
      items={items}
    />
  );
}
