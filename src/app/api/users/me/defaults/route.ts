import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/require-auth";
import { userReceiptDefaultsSchema } from "@/lib/validation";

export async function PUT(request: NextRequest) {
  const { session, error } = await requireAuth();
  if (error) return error;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungueltiger Request-Body." }, { status: 400 });
  }

  const parsed = userReceiptDefaultsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validierungsfehler.", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const defaults = parsed.data;
  const checks = [
    defaults.defaultCountryId
      ? prisma.country.findFirst({ where: { id: defaults.defaultCountryId, active: true }, select: { id: true } })
      : Promise.resolve(null),
    defaults.defaultVehicleId
      ? prisma.vehicle.findFirst({ where: { id: defaults.defaultVehicleId, active: true }, select: { id: true } })
      : Promise.resolve(null),
    defaults.defaultPurposeId
      ? prisma.purpose.findFirst({ where: { id: defaults.defaultPurposeId, active: true }, select: { id: true } })
      : Promise.resolve(null),
  ] as const;

  const [country, vehicle, purpose] = await Promise.all(checks);

  if (defaults.defaultCountryId && !country) {
    return NextResponse.json({ error: "Standard-Land ist nicht gueltig oder nicht mehr aktiv." }, { status: 400 });
  }
  if (defaults.defaultVehicleId && !vehicle) {
    return NextResponse.json({ error: "Standard-Kfz ist nicht gueltig oder nicht mehr aktiv." }, { status: 400 });
  }
  if (defaults.defaultPurposeId && !purpose) {
    return NextResponse.json({ error: "Standard-Zweck ist nicht gueltig oder nicht mehr aktiv." }, { status: 400 });
  }

  const user = await prisma.user.update({
    where: { id: session.userId },
    data: {
      defaultCountryId: defaults.defaultCountryId ?? null,
      defaultVehicleId: defaults.defaultVehicleId ?? null,
      defaultPurposeId: defaults.defaultPurposeId ?? null,
    },
    select: {
      defaultCountryId: true,
      defaultVehicleId: true,
      defaultPurposeId: true,
    },
  });

  return NextResponse.json({
    message: "Standardwerte wurden gespeichert.",
    defaults: user,
  });
}
