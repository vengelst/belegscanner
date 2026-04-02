import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/require-auth";
import { smtpConfigSchema } from "@/lib/validation";
import { encrypt } from "@/lib/encryption";

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const config = await prisma.smtpConfig.findUnique({ where: { id: "default" } });
  if (!config) {
    return NextResponse.json(null);
  }

  return NextResponse.json({
    host: config.host,
    port: config.port,
    secure: config.secure,
    username: config.username,
    password: "********",
    fromAddress: config.fromAddress,
    replyToAddress: config.replyToAddress,
    updatedAt: config.updatedAt,
  });
}

export async function PUT(request: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Ungueltiger Request-Body." }, { status: 400 });
  }

  const parsed = smtpConfigSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validierungsfehler.", details: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const existing = await prisma.smtpConfig.findUnique({ where: { id: "default" } });

  // Password handling: required on first creation, optional on update
  let passwordEncrypted = existing?.passwordEncrypted ?? "";
  if (parsed.data.password && parsed.data.password !== "********") {
    passwordEncrypted = encrypt(parsed.data.password);
  }
  if (!existing && !passwordEncrypted) {
    return NextResponse.json(
      { error: "Passwort ist bei der ersten Einrichtung erforderlich." },
      { status: 400 },
    );
  }

  const config = await prisma.smtpConfig.upsert({
    where: { id: "default" },
    update: {
      host: parsed.data.host,
      port: parsed.data.port,
      secure: parsed.data.secure,
      username: parsed.data.username,
      passwordEncrypted,
      fromAddress: parsed.data.fromAddress,
      replyToAddress: parsed.data.replyToAddress ?? null,
    },
    create: {
      id: "default",
      host: parsed.data.host,
      port: parsed.data.port,
      secure: parsed.data.secure,
      username: parsed.data.username,
      passwordEncrypted,
      fromAddress: parsed.data.fromAddress,
      replyToAddress: parsed.data.replyToAddress ?? null,
    },
  });

  return NextResponse.json({
    host: config.host,
    port: config.port,
    secure: config.secure,
    username: config.username,
    password: "********",
    fromAddress: config.fromAddress,
    replyToAddress: config.replyToAddress,
    updatedAt: config.updatedAt,
  });
}
