import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/require-auth";
import { vehicleSchema } from "@/lib/validation";

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

  const parsed = vehicleSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validierungsfehler.", details: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const existing = await prisma.vehicle.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Kfz nicht gefunden." }, { status: 404 });
  }

  if (parsed.data.plate && parsed.data.plate !== existing.plate) {
    const plateTaken = await prisma.vehicle.findUnique({ where: { plate: parsed.data.plate } });
    if (plateTaken) {
      return NextResponse.json({ error: "Dieses Kennzeichen wird bereits verwendet." }, { status: 409 });
    }
  }

  const vehicle = await prisma.vehicle.update({ where: { id }, data: parsed.data });
  return NextResponse.json(vehicle);
}
