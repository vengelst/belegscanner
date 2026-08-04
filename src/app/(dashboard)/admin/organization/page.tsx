import { connection } from "next/server";
import { getOrganizationProfileDto } from "@/lib/organization";
import { OrganizationSettingsForm } from "@/components/admin/organization-settings-form";

export default async function OrganizationPage() {
  await connection();
  const profile = await getOrganizationProfileDto();

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Eigene Firma</h1>
        <p className="text-sm text-muted-foreground">
          Stammdaten der eigenen Organisation fuer die KI-Beleganalyse. Bei Ausgangsrechnungen
          wird der Kunde als Gegenpartei erkannt (Debitor), bei Eingangsbelegen der Lieferant (Kreditor).
        </p>
      </div>
      <OrganizationSettingsForm
        initial={{
          legalName: profile.legalName,
          tradeName: profile.tradeName ?? "",
          vatId: profile.vatId ?? "",
          street: profile.street ?? "",
          zip: profile.zip ?? "",
          city: profile.city ?? "",
          countryCode: profile.countryCode ?? "",
          updatedAt: profile.updatedAt,
        }}
      />
    </div>
  );
}
