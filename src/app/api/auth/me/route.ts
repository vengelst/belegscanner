import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/require-auth";

export async function GET() {
  const { session, error } = await requireAuth();
  if (error) return error;

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      active: true,
      pinHash: true,
      lastLoginAt: true,
      createdAt: true,
    },
  });

  if (!user || !user.active) {
    return NextResponse.json(
      { error: "Benutzer nicht gefunden." },
      { status: 404 },
    );
  }

  return NextResponse.json({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    hasPin: !!user.pinHash,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
  });
}
