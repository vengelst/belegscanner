import { prisma } from "@/lib/prisma";
import { MasterDataManager } from "@/components/admin/master-data-manager";
import type { FieldDef } from "@/components/admin/master-data-manager";

const fields: FieldDef[] = [
  { key: "name", label: "Name", type: "text", required: true, placeholder: "z.B. Deutschland" },
  { key: "code", label: "ISO-Code", type: "text", placeholder: "z.B. DE" },
  { key: "currencyCode", label: "Waehrung", type: "text", placeholder: "z.B. EUR" },
];

export default async function CountriesPage() {
  const items = await prisma.country.findMany({ orderBy: { sortOrder: "asc" } });

  return (
    <MasterDataManager
      title="Laender"
      description="Laender mit optionalem ISO-Code und Waehrungscode pflegen."
      apiPath="/api/master/countries"
      fields={fields}
      items={items.map((i) => ({ ...i, currencyCode: i.currencyCode ?? "" }))}
    />
  );
}
