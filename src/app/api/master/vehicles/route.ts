import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireAdmin } from "@/lib/auth/require-auth";
import { vehicleSchema } from "@/lib/validation";

export async function GET() {
  const { error } = await requireAuth();
  if (error) return error;

  const vehicles = await prisma.vehicle.findMany({
    orderBy: { sortOrder: "asc" },
  });

  return NextResponse.json(vehicles);
}

export async function POST(request: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Ungueltiger Request-Body." }, { status: 400 });
  }

  const parsed = vehicleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validierungsfehler.", details: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const existing = await prisma.vehicle.findUnique({ where: { plate: parsed.data.plate } });
  if (existing) {
    return NextResponse.json({ error: "Ein Kfz mit diesem Kennzeichen existiert bereits." }, { status: 409 });
  }

  const maxSort = await prisma.vehicle.aggregate({ _max: { sortOrder: true } });
  const vehicle = await prisma.vehicle.create({
    data: {
      plate: parsed.data.plate,
      description: parsed.data.description ?? null,
      sortOrder: parsed.data.sortOrder ?? (maxSort._max.sortOrder ?? -1) + 1,
    },
  });

  return NextResponse.json(vehicle, { status: 201 });
}
