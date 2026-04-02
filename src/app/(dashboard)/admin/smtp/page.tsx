import { prisma } from "@/lib/prisma";
import { SmtpSettingsForm } from "@/components/admin/smtp-settings-form";
import { connection } from "next/server";

export default async function SmtpPage() {
  await connection();
  const config = await prisma.smtpConfig.findUnique({ where: { id: "default" } });

  const initial = config
    ? {
        host: config.host,
        port: config.port,
        secure: config.secure,
        username: config.username,
        fromAddress: config.fromAddress,
        replyToAddress: config.replyToAddress ?? "",
        hasPassword: true,
      }
    : null;

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">SMTP-Einstellungen</h1>
        <p className="text-sm text-muted-foreground">
          SMTP-Server fuer den E-Mail-Versand konfigurieren. Das Passwort wird verschluesselt gespeichert.
        </p>
      </div>
      <SmtpSettingsForm initial={initial} />
    </div>
  );
}
