import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/require-auth";
import { updateUserSchema, adminSetPasswordSchema } from "@/lib/validation";
import { hashSecret } from "@/lib/auth/hash";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      active: true,
      pinHash: true,
      lastLoginAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!user) {
    return NextResponse.json(
      { error: "Benutzer nicht gefunden." },
      { status: 404 },
    );
  }

  return NextResponse.json({
    ...user,
    hasPin: !!user.pinHash,
    pinHash: undefined,
  });
}

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

  // Detect password reset: body has ONLY a "password" key (nothing else)
  const bodyKeys = Object.keys(body as Record<string, unknown>);
  const isPasswordReset = bodyKeys.length === 1 && bodyKeys[0] === "password";
  const passwordParsed = isPasswordReset ? adminSetPasswordSchema.safeParse(body) : null;
  if (passwordParsed?.success) {
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "Benutzer nicht gefunden." },
        { status: 404 },
      );
    }

    const passwordHash = await hashSecret(passwordParsed.data.password);
    await prisma.user.update({
      where: { id },
      data: { passwordHash },
    });

    return NextResponse.json({ message: "Passwort wurde zurueckgesetzt." });
  }

  // Otherwise it's a profile update
  const parsed = updateUserSchema.safeParse(body);
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

  // If email is changing, check uniqueness
  if (parsed.data.email && parsed.data.email !== existing.email) {
    const emailTaken = await prisma.user.findUnique({
      where: { email: parsed.data.email },
    });
    if (emailTaken) {
      return NextResponse.json(
        { error: "Diese E-Mail wird bereits verwendet." },
        { status: 409 },
      );
    }
  }

  const user = await prisma.user.update({
    where: { id },
    data: parsed.data,
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      active: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json(user);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;

  if (id === session.userId) {
    return NextResponse.json(
      { error: "Der eigene Account kann nicht deaktiviert werden." },
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

  await prisma.user.update({
    where: { id },
    data: { active: false },
  });

  return NextResponse.json({ message: "Benutzer wurde deaktiviert." });
}
