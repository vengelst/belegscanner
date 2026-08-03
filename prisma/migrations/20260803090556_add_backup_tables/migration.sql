-- CreateTable
CREATE TABLE "BackupConfig" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "storageType" TEXT NOT NULL DEFAULT 'local',
    "localPath" TEXT NOT NULL DEFAULT '/backups',
    "s3Endpoint" TEXT,
    "s3Bucket" TEXT,
    "s3AccessKey" TEXT,
    "s3SecretKeyEnc" TEXT,
    "s3Region" TEXT,
    "scheduleEnabled" BOOLEAN NOT NULL DEFAULT false,
    "scheduleCron" TEXT NOT NULL DEFAULT '0 2 * * *',
    "retentionDays" INTEGER NOT NULL DEFAULT 30,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BackupConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Backup" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "fileName" TEXT,
    "fileSize" INTEGER,
    "dbRecords" INTEGER,
    "filesCount" INTEGER,
    "errorMessage" TEXT,
    "triggeredBy" TEXT NOT NULL,
    "userId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "Backup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RestoreLog" (
    "id" TEXT NOT NULL,
    "backupId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "errorMessage" TEXT,
    "userId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "RestoreLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Backup_status_idx" ON "Backup"("status");

-- CreateIndex
CREATE INDEX "Backup_startedAt_idx" ON "Backup"("startedAt");

-- CreateIndex
CREATE INDEX "Backup_userId_idx" ON "Backup"("userId");

-- CreateIndex
CREATE INDEX "RestoreLog_backupId_idx" ON "RestoreLog"("backupId");

-- CreateIndex
CREATE INDEX "RestoreLog_userId_idx" ON "RestoreLog"("userId");

-- AddForeignKey
ALTER TABLE "Backup" ADD CONSTRAINT "Backup_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RestoreLog" ADD CONSTRAINT "RestoreLog_backupId_fkey" FOREIGN KEY ("backupId") REFERENCES "Backup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RestoreLog" ADD CONSTRAINT "RestoreLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
