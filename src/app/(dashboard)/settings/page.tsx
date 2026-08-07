import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { ChangePasswordForm } from "@/components/settings/change-password-form";
import { ChangePinForm } from "@/components/settings/change-pin-form";
import { NavigationDisplayForm } from "@/components/settings/navigation-display-form";
import { UserReceiptDefaultsForm } from "@/components/settings/user-receipt-defaults-form";
import { SettingsModeSwitch } from "@/components/settings/settings-mode-switch";
import { TemplateSelector } from "@/components/settings/template-selector";
import { AutoCaptureSensitivityForm } from "@/components/settings/auto-capture-sensitivity-form";
import { connection } from "next/server";
import type { UiTemplate } from "@/lib/validation";
import packageJson from "../../../../package.json";

export default async function UserSettingsPage() {
  await connection();
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const [user, purposes, countries, vehicles] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        pinHash: true,
        uiTemplate: true,
        defaultCountryId: true,
        defaultVehicleId: true,
        defaultPurposeId: true,
      },
    }),
    prisma.purpose.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    prisma.country.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    prisma.vehicle.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { plate: "asc" }] }),
  ]);

  if (!user) redirect("/login");

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <SettingsModeSwitch active="personal" showAdmin={user.role === "ADMIN"} />
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">Einstellungen</h1>
          <p className="text-sm text-muted-foreground">
            Persoenliche Voreinstellungen, Passwort und PIN fuer deinen Arbeitsbereich.
          </p>
          <p className="text-xs text-muted-foreground">BelegBox Version {packageJson.version}</p>
        </div>
      </div>
      <div className="space-y-2">
        <h2 className="text-xl font-semibold tracking-tight">Profil</h2>
        <p className="text-sm text-muted-foreground">
          {user.name} &middot; {user.email} &middot; {user.role}
        </p>
      </div>
      <div className="space-y-4">
        <div className="space-y-2">
          <h2 className="text-xl font-semibold tracking-tight">Darstellung</h2>
          <p className="text-sm text-muted-foreground">
            Waehle das Erscheinungsbild der App.
          </p>
        </div>
        <TemplateSelector currentTemplate={user.uiTemplate as UiTemplate} />
      </div>
      <AutoCaptureSensitivityForm />
      <NavigationDisplayForm />
      <UserReceiptDefaultsForm
        initialDefaults={{
          defaultCountryId: user.defaultCountryId,
          defaultVehicleId: user.defaultVehicleId,
          defaultPurposeId: user.defaultPurposeId,
        }}
        purposes={purposes.map((purpose) => ({ id: purpose.id, label: purpose.name }))}
        countries={countries.map((country) => ({ id: country.id, label: country.code ? `${country.name} (${country.code})` : country.name }))}
        vehicles={vehicles.map((vehicle) => ({ id: vehicle.id, label: vehicle.description ? `${vehicle.plate} - ${vehicle.description}` : vehicle.plate }))}
      />
      <ChangePasswordForm />
      <ChangePinForm hasPin={!!user.pinHash} />
    </div>
  );
}
