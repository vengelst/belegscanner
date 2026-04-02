import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/require-auth";
import { setPinSchema } from "@/lib/validation";
import { hashSecret } from "@/lib/auth/hash";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Ungueltiger Request-Body." },
      { status: 400 },
    );
  }

  const parsed = setPinSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validierungsfehler.", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json(
      { error: "Benutzer nicht gefunden." },
      { status: 404 },
    );
  }

  const pinHash = await hashSecret(parsed.data.pin);

  await prisma.user.update({
    where: { id },
    data: {
      pinHash,
      failedPinAttempts: 0,
      pinLockedUntil: null,
    },
  });

  return NextResponse.json({ message: "PIN wurde gesetzt." });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;

  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json(
      { error: "Benutzer nicht gefunden." },
      { status: 404 },
    );
  }

  await prisma.user.update({
    where: { id },
    data: {
      pinHash: null,
      failedPinAttempts: 0,
      pinLockedUntil: null,
    },
  });

  return NextResponse.json({ message: "PIN wurde entfernt." });
}
