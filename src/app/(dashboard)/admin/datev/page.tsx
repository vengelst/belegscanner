import { prisma } from "@/lib/prisma";
import { DatevProfileManager } from "@/components/admin/datev-profile-manager";
import { connection } from "next/server";

export default async function DatevPage() {
  await connection();
  const profiles = await prisma.datevProfile.findMany({
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
  });

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">DATEV-Profile</h1>
        <p className="text-sm text-muted-foreground">
          DATEV-Versandprofile mit Zieladresse, Absender und optionalen Templates verwalten.
        </p>
      </div>
      <DatevProfileManager profiles={profiles.map((p) => ({
        id: p.id,
        name: p.name,
        datevAddress: p.datevAddress,
        senderAddress: p.senderAddress,
        subjectTemplate: p.subjectTemplate ?? "",
        bodyTemplate: p.bodyTemplate ?? "",
        isDefault: p.isDefault,
        active: p.active,
      }))} />
    </div>
  );
}
