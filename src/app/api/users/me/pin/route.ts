import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/require-auth";
import { changePinSchema } from "@/lib/validation";
import { hashSecret, compareSecret } from "@/lib/auth/hash";

export async function PUT(request: NextRequest) {
  const { session, error } = await requireAuth();
  if (error) return error;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Ungueltiger Request-Body." },
      { status: 400 },
    );
  }

  const parsed = changePinSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validierungsfehler.", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
  });

  if (!user) {
    return NextResponse.json(
      { error: "Benutzer nicht gefunden." },
      { status: 404 },
    );
  }

  const otherUsersWithPin = await prisma.user.findMany({
    where: {
      id: { not: session.userId },
      active: true,
      pinHash: { not: null },
    },
    select: { pinHash: true },
  });

  for (const other of otherUsersWithPin) {
    if (await compareSecret(parsed.data.pin, other.pinHash!)) {
      return NextResponse.json(
        { error: "Diese PIN ist bereits vergeben." },
        { status: 409 },
      );
    }
  }

  const pinHash = await hashSecret(parsed.data.pin);
  await prisma.user.update({
    where: { id: session.userId },
    data: {
      pinHash,
      failedPinAttempts: 0,
      pinLockedUntil: null,
    },
  });

  return NextResponse.json({ message: "PIN wurde geaendert." });
}
