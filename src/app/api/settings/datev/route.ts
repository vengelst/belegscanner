import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/require-auth";
import { datevProfileSchema } from "@/lib/validation";

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const profiles = await prisma.datevProfile.findMany({
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
  });

  return NextResponse.json(profiles);
}

export async function POST(request: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Ungueltiger Request-Body." }, { status: 400 });
  }

  const parsed = datevProfileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validierungsfehler.", details: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const existing = await prisma.datevProfile.findUnique({ where: { name: parsed.data.name } });
  if (existing) {
    return NextResponse.json({ error: "Ein Profil mit diesem Namen existiert bereits." }, { status: 409 });
  }

  // If setting as default, unset other defaults
  if (parsed.data.isDefault) {
    await prisma.datevProfile.updateMany({
      where: { isDefault: true },
      data: { isDefault: false },
    });
  }

  const profile = await prisma.datevProfile.create({
    data: {
      name: parsed.data.name,
      datevAddress: parsed.data.datevAddress,
      senderAddress: parsed.data.senderAddress,
      subjectTemplate: parsed.data.subjectTemplate ?? null,
      bodyTemplate: parsed.data.bodyTemplate ?? null,
      isDefault: parsed.data.isDefault ?? false,
    },
  });

  return NextResponse.json(profile, { status: 201 });
}
