import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireAdmin } from "@/lib/auth/require-auth";
import { countrySchema } from "@/lib/validation";

export async function GET() {
  const { error } = await requireAuth();
  if (error) return error;

  const countries = await prisma.country.findMany({
    orderBy: { sortOrder: "asc" },
  });

  return NextResponse.json(countries);
}

export async function POST(request: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Ungueltiger Request-Body." }, { status: 400 });
  }

  const parsed = countrySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validierungsfehler.", details: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  if (parsed.data.code) {
    const existing = await prisma.country.findUnique({ where: { code: parsed.data.code } });
    if (existing) {
      return NextResponse.json({ error: "Ein Land mit diesem Code existiert bereits." }, { status: 409 });
    }
  }

  const maxSort = await prisma.country.aggregate({ _max: { sortOrder: true } });
  const country = await prisma.country.create({
    data: {
      name: parsed.data.name,
      code: parsed.data.code ?? null,
      currencyCode: parsed.data.currencyCode ?? null,
      sortOrder: parsed.data.sortOrder ?? (maxSort._max.sortOrder ?? -1) + 1,
    },
  });

  return NextResponse.json(country, { status: 201 });
}
