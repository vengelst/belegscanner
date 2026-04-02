import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/require-auth";
import { decrypt } from "@/lib/encryption";
import nodemailer from "nodemailer";

export async function POST() {
  const { error } = await requireAdmin();
  if (error) return error;

  const config = await prisma.smtpConfig.findUnique({ where: { id: "default" } });
  if (!config) {
    return NextResponse.json({ error: "SMTP ist nicht konfiguriert." }, { status: 400 });
  }

  let password: string;
  try {
    password = decrypt(config.passwordEncrypted);
  } catch {
    return NextResponse.json({ error: "SMTP-Passwort konnte nicht entschluesselt werden." }, { status: 500 });
  }

  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.username, pass: password },
  });

  try {
    await transporter.verify();

    await transporter.sendMail({
      from: config.fromAddress,
      to: config.fromAddress,
      subject: "BelegBox SMTP-Test",
      text: "Diese E-Mail bestaetigt, dass die SMTP-Konfiguration funktioniert.",
    });

    return NextResponse.json({ message: "Test-Mail wurde erfolgreich versendet." });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unbekannter Fehler";
    return NextResponse.json({ error: `SMTP-Test fehlgeschlagen: ${msg}` }, { status: 500 });
  }
}
