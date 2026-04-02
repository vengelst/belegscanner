import { prisma } from "@/lib/prisma";
import { connection } from "next/server";

export default async function AdminDashboardPage() {
  await connection();
  const [
    totalReceipts,
    openReceipts,
    sentReceipts,
    failedReceipts,
    totalUsers,
    smtpConfigured,
    datevProfiles,
  ] = await Promise.all([
    prisma.receipt.count(),
    prisma.receipt.count({ where: { sendStatus: "OPEN" } }),
    prisma.receipt.count({ where: { sendStatus: "SENT" } }),
    prisma.receipt.count({ where: { sendStatus: "FAILED" } }),
    prisma.user.count({ where: { active: true } }),
    prisma.smtpConfig.findUnique({ where: { id: "default" }, select: { id: true } }),
    prisma.datevProfile.count({ where: { active: true } }),
  ]);

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <p className="text-sm font-medium uppercase tracking-[0.24em] text-muted-foreground">
          Administration
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Belege gesamt" value={totalReceipts} />
        <StatCard label="Offen" value={openReceipts} muted={openReceipts === 0} />
        <StatCard label="Gesendet" value={sentReceipts} />
        <StatCard label="Fehlgeschlagen" value={failedReceipts} danger={failedReceipts > 0} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatusCard
          label="Aktive Benutzer"
          value={String(totalUsers)}
        />
        <StatusCard
          label="SMTP"
          value={smtpConfigured ? "Konfiguriert" : "Nicht konfiguriert"}
          warning={!smtpConfigured}
        />
        <StatusCard
          label="DATEV-Profile"
          value={`${datevProfiles} aktiv`}
          warning={datevProfiles === 0}
        />
      </div>
    </div>
  );
}

function StatCard({ label, value, muted, danger }: { label: string; value: number; muted?: boolean; danger?: boolean }) {
  let valueColor = "text-foreground";
  if (muted) valueColor = "text-muted-foreground";
  if (danger) valueColor = "text-danger";

  return (
    <div className="rounded-[calc(var(--radius)+0.5rem)] border border-border/80 bg-card p-5 shadow-soft">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`mt-2 text-3xl font-semibold tabular-nums ${valueColor}`}>{value}</p>
    </div>
  );
}

function StatusCard({ label, value, warning }: { label: string; value: string; warning?: boolean }) {
  return (
    <div className="rounded-[calc(var(--radius)+0.5rem)] border border-border/80 bg-card p-5 shadow-soft">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`mt-2 text-lg font-semibold ${warning ? "text-danger" : "text-foreground"}`}>{value}</p>
    </div>
  );
}
