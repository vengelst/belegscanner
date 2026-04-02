import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/require-auth";
import { purposeSchema } from "@/lib/validation";

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

  const parsed = purposeSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validierungsfehler.", details: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const existing = await prisma.purpose.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Zweck nicht gefunden." }, { status: 404 });
  }

  if (parsed.data.name && parsed.data.name !== existing.name) {
    const nameTaken = await prisma.purpose.findUnique({ where: { name: parsed.data.name } });
    if (nameTaken) {
      return NextResponse.json({ error: "Dieser Name wird bereits verwendet." }, { status: 409 });
    }
  }

  const purpose = await prisma.purpose.update({ where: { id }, data: parsed.data });
  return NextResponse.json(purpose);
}
