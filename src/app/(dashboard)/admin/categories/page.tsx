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
      title="Kategorien"
      description="Zahlungskategorien fuer Belege pflegen."
      apiPath="/api/master/categories"
      fields={fields}
      items={items}
    />
  );
}
