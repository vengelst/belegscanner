import { prisma } from "@/lib/prisma";
import { connection } from "next/server";
import {
  BackupConfigForm,
  BackupScheduleForm,
  BackupTrigger,
  BackupHistoryTable,
} from "@/components/admin/backup";
import { getSchedulerStatus } from "@/lib/backup";

type SearchParams = Promise<{ page?: string; limit?: string }>;

export default async function BackupPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await connection();
  const params = await searchParams;

  const page = parseInt(params.page ?? "1", 10);
  const limit = parseInt(params.limit ?? "20", 10);

  const [config, backups, total, runningBackup, schedulerStatus] = await Promise.all([
    prisma.backupConfig.findUnique({ where: { id: "singleton" } }),
    prisma.backup.findMany({
      orderBy: { startedAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        user: { select: { id: true, name: true, email: true } },
        _count: { select: { restoreLogs: true } },
      },
    }),
    prisma.backup.count(),
    prisma.backup.findFirst({
      where: { status: { in: ["pending", "running"] } },
      orderBy: { startedAt: "desc" },
    }),
    getSchedulerStatus(),
  ]);

  const backupConfig = config
    ? {
        storageType: config.storageType as "local" | "s3",
        localPath: config.localPath,
        s3Endpoint: config.s3Endpoint,
        s3Bucket: config.s3Bucket,
        s3AccessKey: config.s3AccessKey,
        s3SecretKey: config.s3SecretKeyEnc ? "********" : null,
        s3Region: config.s3Region,
      }
    : {
        storageType: "local" as const,
        localPath: "/backups",
        s3Endpoint: null,
        s3Bucket: null,
        s3AccessKey: null,
        s3SecretKey: null,
        s3Region: null,
      };

  const scheduleConfig = {
    scheduleEnabled: config?.scheduleEnabled ?? false,
    scheduleCron: config?.scheduleCron ?? "0 2 * * *",
    retentionDays: config?.retentionDays ?? 30,
    scheduler: schedulerStatus,
  };

  const backupEntries = backups.map((b) => ({
    id: b.id,
    type: b.type as "full" | "database" | "files",
    status: b.status as "pending" | "running" | "completed" | "failed",
    fileName: b.fileName,
    fileSize: b.fileSize,
    dbRecords: b.dbRecords,
    filesCount: b.filesCount,
    errorMessage: b.errorMessage,
    triggeredBy: b.triggeredBy as "manual" | "scheduled",
    user: b.user,
    restoreCount: b._count.restoreLogs,
    startedAt: b.startedAt.toISOString(),
    completedAt: b.completedAt?.toISOString() ?? null,
  }));

  const runningBackupInfo = runningBackup
    ? {
        id: runningBackup.id,
        type: runningBackup.type,
        status: runningBackup.status,
        startedAt: runningBackup.startedAt.toISOString(),
      }
    : null;

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Backup-Verwaltung</h1>
        <p className="text-sm text-muted-foreground">
          Backups konfigurieren, planen und verwalten. Daten koennen bei Bedarf wiederhergestellt werden.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <BackupConfigForm config={backupConfig} />
        <BackupScheduleForm config={scheduleConfig} />
      </div>

      <BackupTrigger runningBackup={runningBackupInfo} />

      <BackupHistoryTable
        backups={backupEntries}
        pagination={{
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        }}
      />
    </div>
  );
}
