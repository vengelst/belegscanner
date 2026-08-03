import { prisma } from "@/lib/prisma";
import { connection } from "next/server";

export default async function AdminDashboardPage() {
  await connection();
  const [
    totalReceipts,
    openReceipts,
    sentReceipts,
    failedReceipts,
    creditorStats,
    debtorStats,
    totalUsers,
    smtpConfigured,
    datevProfiles,
  ] = await Promise.all([
    prisma.receipt.count({ where: { deletedAt: null } }),
    prisma.receipt.count({ where: { sendStatus: "OPEN", deletedAt: null } }),
    prisma.receipt.count({ where: { sendStatus: "SENT", deletedAt: null } }),
    prisma.receipt.count({ where: { sendStatus: "FAILED", deletedAt: null } }),
    prisma.receipt.aggregate({
      where: { deletedAt: null, partyRole: "CREDITOR" },
      _count: true,
      _sum: { amountEur: true },
    }),
    prisma.receipt.aggregate({
      where: { deletedAt: null, partyRole: "DEBTOR" },
      _count: true,
      _sum: { amountEur: true },
    }),
    prisma.user.count({ where: { active: true } }),
    prisma.smtpConfig.findUnique({ where: { id: "default" }, select: { id: true } }),
    prisma.datevProfile.count({ where: { active: true } }),
  ]);

  const fmtEur = (value: number) =>
    value.toLocaleString("de-DE", { style: "currency", currency: "EUR" });

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

      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard
          label="Kreditorenbelege"
          value={creditorStats._count}
          detail={fmtEur(Number(creditorStats._sum.amountEur ?? 0))}
        />
        <StatCard
          label="Debitorenbelege"
          value={debtorStats._count}
          detail={fmtEur(Number(debtorStats._sum.amountEur ?? 0))}
        />
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

function StatCard({ label, value, muted, danger, detail }: { label: string; value: number; muted?: boolean; danger?: boolean; detail?: string }) {
  let valueColor = "text-foreground";
  if (muted) valueColor = "text-muted-foreground";
  if (danger) valueColor = "text-danger";

  return (
    <div className="rounded-[calc(var(--radius)+0.5rem)] border border-border/80 bg-card p-5 shadow-soft">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`mt-2 text-3xl font-semibold tabular-nums ${valueColor}`}>{value}</p>
      {detail ? <p className="mt-1 text-sm text-muted-foreground tabular-nums">{detail}</p> : null}
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
