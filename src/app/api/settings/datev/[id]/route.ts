import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/require-auth";
import { datevProfileSchema } from "@/lib/validation";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Ungueltiger Request-Body." }, { status: 400 });
  }

  const parsed = datevProfileSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validierungsfehler.", details: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const existing = await prisma.datevProfile.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Profil nicht gefunden." }, { status: 404 });
  }

  if (parsed.data.name && parsed.data.name !== existing.name) {
    const nameTaken = await prisma.datevProfile.findUnique({ where: { name: parsed.data.name } });
    if (nameTaken) {
      return NextResponse.json({ error: "Dieser Profilname wird bereits verwendet." }, { status: 409 });
    }
  }

  if (parsed.data.isDefault) {
    await prisma.datevProfile.updateMany({
      where: { isDefault: true, id: { not: id } },
      data: { isDefault: false },
    });
  }

  // Belegtyp-Adressen werden als komplette Liste gesetzt: nicht uebergebene
  // Belegtypen gelten als "nicht konfiguriert" und werden entfernt.
  const { belegtypAddresses, ...profileData } = parsed.data;

  const profile = await prisma.$transaction(async (tx) => {
    if (belegtypAddresses) {
      await tx.datevBelegtypAddress.deleteMany({ where: { profileId: id } });
      if (belegtypAddresses.length > 0) {
        await tx.datevBelegtypAddress.createMany({
          data: belegtypAddresses.map((entry) => ({
            profileId: id,
            belegtyp: entry.belegtyp,
            datevAddress: entry.datevAddress,
          })),
        });
      }
    }

    return tx.datevProfile.update({
      where: { id },
      data: profileData,
      include: { belegtypAddresses: { orderBy: { belegtyp: "asc" } } },
    });
  });

  return NextResponse.json(profile);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;

  const existing = await prisma.datevProfile.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Profil nicht gefunden." }, { status: 404 });
  }

  await prisma.datevProfile.update({
    where: { id },
    data: { active: false },
  });

  return NextResponse.json({ message: "Profil wurde deaktiviert." });
}
