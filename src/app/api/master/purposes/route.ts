import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireAdmin } from "@/lib/auth/require-auth";
import { purposeSchema } from "@/lib/validation";

export async function GET() {
  const { error } = await requireAuth();
  if (error) return error;

  const purposes = await prisma.purpose.findMany({
    orderBy: { sortOrder: "asc" },
  });

  return NextResponse.json(purposes);
}

export async function POST(request: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Ungueltiger Request-Body." }, { status: 400 });
  }

  const parsed = purposeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validierungsfehler.", details: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const existing = await prisma.purpose.findUnique({ where: { name: parsed.data.name } });
  if (existing) {
    return NextResponse.json({ error: "Ein Zweck mit diesem Namen existiert bereits." }, { status: 409 });
  }

  const maxSort = await prisma.purpose.aggregate({ _max: { sortOrder: true } });
  const purpose = await prisma.purpose.create({
    data: {
      name: parsed.data.name,
      isHospitality: parsed.data.isHospitality ?? false,
      sortOrder: parsed.data.sortOrder ?? (maxSort._max.sortOrder ?? -1) + 1,
    },
  });

  return NextResponse.json(purpose, { status: 201 });
}
