import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/require-auth";
import { userTemplateSchema } from "@/lib/validation";

export async function GET() {
  const { session, error } = await requireAuth();
  if (error) return error;

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { uiTemplate: true },
  });

  if (!user) {
    return NextResponse.json({ error: "Benutzer nicht gefunden." }, { status: 404 });
  }

  return NextResponse.json({ uiTemplate: user.uiTemplate });
}

export async function PUT(request: NextRequest) {
  const { session, error } = await requireAuth();
  if (error) return error;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungueltiger Request-Body." }, { status: 400 });
  }

  const parsed = userTemplateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validierungsfehler.", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const user = await prisma.user.update({
    where: { id: session.userId },
    data: { uiTemplate: parsed.data.uiTemplate },
    select: { uiTemplate: true },
  });

  return NextResponse.json({
    message: "Template wurde gespeichert.",
    uiTemplate: user.uiTemplate,
  });
}
