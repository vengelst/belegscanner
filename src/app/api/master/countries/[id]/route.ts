import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/require-auth";
import { countrySchema } from "@/lib/validation";

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

  const parsed = countrySchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validierungsfehler.", details: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const existing = await prisma.country.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Land nicht gefunden." }, { status: 404 });
  }

  if (parsed.data.code && parsed.data.code !== existing.code) {
    const codeTaken = await prisma.country.findUnique({ where: { code: parsed.data.code } });
    if (codeTaken) {
      return NextResponse.json({ error: "Ein Land mit diesem Code existiert bereits." }, { status: 409 });
    }
  }

  const country = await prisma.country.update({
    where: { id },
    data: parsed.data,
  });

  return NextResponse.json(country);
}
