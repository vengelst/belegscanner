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

  const profile = await prisma.datevProfile.update({ where: { id }, data: parsed.data });
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
