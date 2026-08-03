import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";
import { createGzip } from "zlib";
import { pipeline } from "stream/promises";
import { createReadStream, createWriteStream } from "fs";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/encryption";
import {
  createStorageProvider,
  type StorageConfig,
  type StorageProvider,
} from "./storage-provider";

const execAsync = promisify(exec);

export type BackupType = "full" | "database" | "files";
export type BackupStatus = "pending" | "running" | "completed" | "failed";

interface BackupResult {
  fileName: string;
  fileSize: number;
  dbRecords?: number;
  filesCount?: number;
}

// Storage-Pfad fuer Belegdateien
const STORAGE_ROOT = process.env.STORAGE_PATH ?? "./storage";

// Temporaeres Verzeichnis fuer Backup-Erstellung
const TEMP_DIR = "/tmp/belegbox-backup";

// Hilfsfunktion zum Parsen der DATABASE_URL
function parseDatabaseUrl(): {
  host: string;
  port: string;
  user: string;
  password: string;
  database: string;
} {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL ist nicht konfiguriert.");
  }

  // Format: postgresql://user:password@host:port/database
  const match = url.match(
    /^postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)$/
  );
  if (!match) {
    throw new Error("DATABASE_URL hat ein ungueltiges Format.");
  }

  return {
    user: match[1],
    password: match[2],
    host: match[3],
    port: match[4],
    database: match[5].split("?")[0], // Query-Parameter entfernen
  };
}

// Backup-Konfiguration aus der Datenbank laden
async function loadBackupConfig(): Promise<{
  storageConfig: StorageConfig;
  retentionDays: number;
}> {
  const config = await prisma.backupConfig.findUnique({
    where: { id: "singleton" },
  });

  if (!config) {
    return {
      storageConfig: {
        type: "local",
        localPath: "/app/storage/backups",
      },
      retentionDays: 30,
    };
  }

  if (config.storageType === "s3") {
    if (!config.s3Endpoint || !config.s3Bucket || !config.s3AccessKey || !config.s3SecretKeyEnc) {
      throw new Error("S3-Konfiguration ist unvollstaendig.");
    }
    return {
      storageConfig: {
        type: "s3",
        endpoint: config.s3Endpoint,
        bucket: config.s3Bucket,
        accessKey: config.s3AccessKey,
        secretKey: decrypt(config.s3SecretKeyEnc),
        region: config.s3Region ?? undefined,
      },
      retentionDays: config.retentionDays,
    };
  }

  return {
    storageConfig: {
      type: "local",
      localPath: config.localPath,
    },
    retentionDays: config.retentionDays,
  };
}

// Datenbank-Backup erstellen (pg_dump)
async function createDatabaseBackup(): Promise<{
  filePath: string;
  dbRecords: number;
}> {
  const db = parseDatabaseUrl();
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const sqlFile = path.join(TEMP_DIR, `db-${timestamp}.sql`);
  const gzFile = `${sqlFile}.gz`;

  await fs.mkdir(TEMP_DIR, { recursive: true });

  // pg_dump ausfuehren
  const env = { ...process.env, PGPASSWORD: db.password };
  await execAsync(
    `pg_dump -h ${db.host} -p ${db.port} -U ${db.user} -d ${db.database} -F p -f "${sqlFile}"`,
    { env }
  );

  // SQL-Datei komprimieren
  await pipeline(
    createReadStream(sqlFile),
    createGzip(),
    createWriteStream(gzFile)
  );

  // Unkomprimierte Datei loeschen
  await fs.unlink(sqlFile);

  // Anzahl der Datensaetze zaehlen
  const [receiptsCount, usersCount] = await Promise.all([
    prisma.receipt.count(),
    prisma.user.count(),
  ]);

  return {
    filePath: gzFile,
    dbRecords: receiptsCount + usersCount,
  };
}

// Datei-Backup erstellen (tar.gz des Storage-Verzeichnisses)
async function createFilesBackup(): Promise<{
  filePath: string;
  filesCount: number;
}> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const tarFile = path.join(TEMP_DIR, `files-${timestamp}.tar.gz`);

  await fs.mkdir(TEMP_DIR, { recursive: true });

  // Pruefen ob Storage-Verzeichnis existiert
  try {
    await fs.access(STORAGE_ROOT);
  } catch {
    // Leeres Archiv erstellen wenn kein Storage existiert
    await execAsync(`tar -czf "${tarFile}" --files-from /dev/null`);
    return { filePath: tarFile, filesCount: 0 };
  }

  // tar.gz erstellen
  await execAsync(
    `tar -czf "${tarFile}" -C "${path.dirname(STORAGE_ROOT)}" "${path.basename(STORAGE_ROOT)}"`
  );

  // Anzahl der Dateien zaehlen
  const filesCount = await prisma.receiptFile.count();

  return { filePath: tarFile, filesCount };
}

// Vollstaendiges Backup erstellen (DB + Dateien)
async function createFullBackup(): Promise<{
  filePath: string;
  dbRecords: number;
  filesCount: number;
}> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const fullBackupDir = path.join(TEMP_DIR, `full-${timestamp}`);
  const tarFile = path.join(TEMP_DIR, `full-${timestamp}.tar.gz`);

  await fs.mkdir(fullBackupDir, { recursive: true });

  // Datenbank-Backup erstellen
  const dbBackup = await createDatabaseBackup();
  await fs.rename(dbBackup.filePath, path.join(fullBackupDir, "database.sql.gz"));

  // Dateien kopieren
  try {
    await fs.access(STORAGE_ROOT);
    await execAsync(`cp -r "${STORAGE_ROOT}" "${fullBackupDir}/storage"`);
  } catch {
    await fs.mkdir(path.join(fullBackupDir, "storage"), { recursive: true });
  }

  // Alles in ein Archiv packen
  await execAsync(
    `tar -czf "${tarFile}" -C "${path.dirname(fullBackupDir)}" "${path.basename(fullBackupDir)}"`
  );

  // Temporaere Dateien aufraeumen
  await fs.rm(fullBackupDir, { recursive: true, force: true });

  const filesCount = await prisma.receiptFile.count();

  return {
    filePath: tarFile,
    dbRecords: dbBackup.dbRecords,
    filesCount,
  };
}

// Hauptfunktion zum Erstellen eines Backups
export async function createBackup(
  type: BackupType,
  triggeredBy: "manual" | "scheduled",
  userId?: string
): Promise<string> {
  // Backup-Eintrag erstellen
  const backup = await prisma.backup.create({
    data: {
      type,
      status: "pending",
      triggeredBy,
      userId,
    },
  });

  try {
    // Status auf "running" setzen
    await prisma.backup.update({
      where: { id: backup.id },
      data: { status: "running" },
    });

    // Konfiguration laden
    const { storageConfig } = await loadBackupConfig();
    const storage = createStorageProvider(storageConfig);

    let result: BackupResult;
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

    switch (type) {
      case "database": {
        const dbBackup = await createDatabaseBackup();
        const fileName = `backup-db-${timestamp}.sql.gz`;
        const data = await fs.readFile(dbBackup.filePath);
        await storage.upload(fileName, data);
        await fs.unlink(dbBackup.filePath);
        result = {
          fileName,
          fileSize: data.length,
          dbRecords: dbBackup.dbRecords,
        };
        break;
      }
      case "files": {
        const filesBackup = await createFilesBackup();
        const fileName = `backup-files-${timestamp}.tar.gz`;
        const data = await fs.readFile(filesBackup.filePath);
        await storage.upload(fileName, data);
        await fs.unlink(filesBackup.filePath);
        result = {
          fileName,
          fileSize: data.length,
          filesCount: filesBackup.filesCount,
        };
        break;
      }
      case "full": {
        const fullBackup = await createFullBackup();
        const fileName = `backup-full-${timestamp}.tar.gz`;
        const data = await fs.readFile(fullBackup.filePath);
        await storage.upload(fileName, data);
        await fs.unlink(fullBackup.filePath);
        result = {
          fileName,
          fileSize: data.length,
          dbRecords: fullBackup.dbRecords,
          filesCount: fullBackup.filesCount,
        };
        break;
      }
    }

    // Backup als erfolgreich markieren
    await prisma.backup.update({
      where: { id: backup.id },
      data: {
        status: "completed",
        fileName: result.fileName,
        fileSize: result.fileSize,
        dbRecords: result.dbRecords,
        filesCount: result.filesCount,
        completedAt: new Date(),
      },
    });

    return backup.id;
  } catch (error) {
    // Backup als fehlgeschlagen markieren
    await prisma.backup.update({
      where: { id: backup.id },
      data: {
        status: "failed",
        errorMessage: error instanceof Error ? error.message : "Unbekannter Fehler",
        completedAt: new Date(),
      },
    });
    throw error;
  }
}

// Backup herunterladen
export async function downloadBackup(backupId: string): Promise<{
  data: Buffer;
  fileName: string;
}> {
  const backup = await prisma.backup.findUnique({
    where: { id: backupId },
  });

  if (!backup) {
    throw new Error("Backup nicht gefunden.");
  }

  if (backup.status !== "completed" || !backup.fileName) {
    throw new Error("Backup ist nicht verfuegbar.");
  }

  const { storageConfig } = await loadBackupConfig();
  const storage = createStorageProvider(storageConfig);

  const data = await storage.download(backup.fileName);

  return { data, fileName: backup.fileName };
}

// Backup loeschen
export async function deleteBackup(backupId: string): Promise<void> {
  const backup = await prisma.backup.findUnique({
    where: { id: backupId },
  });

  if (!backup) {
    throw new Error("Backup nicht gefunden.");
  }

  const { storageConfig } = await loadBackupConfig();
  const storage = createStorageProvider(storageConfig);

  // Datei loeschen wenn vorhanden
  if (backup.fileName) {
    await storage.delete(backup.fileName);
  }

  // Datenbank-Eintrag loeschen
  await prisma.backup.delete({
    where: { id: backupId },
  });
}

// Alte Backups basierend auf Retention-Policy loeschen
export async function cleanupOldBackups(): Promise<number> {
  const { retentionDays } = await loadBackupConfig();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

  const oldBackups = await prisma.backup.findMany({
    where: {
      status: "completed",
      completedAt: {
        lt: cutoffDate,
      },
    },
  });

  let deletedCount = 0;
  for (const backup of oldBackups) {
    try {
      await deleteBackup(backup.id);
      deletedCount++;
    } catch (error) {
      console.error(`Fehler beim Loeschen von Backup ${backup.id}:`, error);
    }
  }

  return deletedCount;
}

// Storage-Provider fuer externe Verwendung exportieren
export async function getStorageProvider(): Promise<StorageProvider> {
  const { storageConfig } = await loadBackupConfig();
  return createStorageProvider(storageConfig);
}

// Backup-Wiederherstellung starten
export async function startRestore(
  backupId: string,
  userId: string
): Promise<string> {
  const backup = await prisma.backup.findUnique({
    where: { id: backupId },
  });

  if (!backup) {
    throw new Error("Backup nicht gefunden.");
  }

  if (backup.status !== "completed" || !backup.fileName) {
    throw new Error("Backup ist nicht fuer Wiederherstellung verfuegbar.");
  }

  // Restore-Log erstellen
  const restoreLog = await prisma.restoreLog.create({
    data: {
      backupId,
      status: "pending",
      userId,
    },
  });

  // Wiederherstellung im Hintergrund starten
  performRestore(backupId, restoreLog.id).catch((error) => {
    console.error("Restore fehlgeschlagen:", error);
  });

  return restoreLog.id;
}

// Wiederherstellung durchfuehren (asynchron)
async function performRestore(
  backupId: string,
  restoreLogId: string
): Promise<void> {
  try {
    await prisma.restoreLog.update({
      where: { id: restoreLogId },
      data: { status: "running" },
    });

    const backup = await prisma.backup.findUnique({
      where: { id: backupId },
    });

    if (!backup?.fileName) {
      throw new Error("Backup-Datei nicht gefunden.");
    }

    const { storageConfig } = await loadBackupConfig();
    const storage = createStorageProvider(storageConfig);
    const data = await storage.download(backup.fileName);

    // Temporaere Datei erstellen
    const tempFile = path.join(TEMP_DIR, backup.fileName);
    await fs.mkdir(TEMP_DIR, { recursive: true });
    await fs.writeFile(tempFile, data);

    const db = parseDatabaseUrl();
    const env = { ...process.env, PGPASSWORD: db.password };

    switch (backup.type) {
      case "database": {
        // SQL-Dump entpacken und wiederherstellen
        const sqlFile = tempFile.replace(".gz", "");
        await execAsync(`gunzip -c "${tempFile}" > "${sqlFile}"`);
        await execAsync(
          `psql -h ${db.host} -p ${db.port} -U ${db.user} -d ${db.database} -f "${sqlFile}"`,
          { env }
        );
        await fs.unlink(sqlFile);
        break;
      }
      case "files": {
        // Dateien entpacken
        await execAsync(
          `tar -xzf "${tempFile}" -C "${path.dirname(STORAGE_ROOT)}"`
        );
        break;
      }
      case "full": {
        // Vollstaendiges Backup entpacken
        const extractDir = path.join(TEMP_DIR, "restore-extract");
        await fs.mkdir(extractDir, { recursive: true });
        await execAsync(`tar -xzf "${tempFile}" -C "${extractDir}"`);

        // Datenbank wiederherstellen
        const dirs = await fs.readdir(extractDir);
        const backupDir = path.join(extractDir, dirs[0]);
        const dbFile = path.join(backupDir, "database.sql.gz");
        const sqlFile = dbFile.replace(".gz", "");
        await execAsync(`gunzip -c "${dbFile}" > "${sqlFile}"`);
        await execAsync(
          `psql -h ${db.host} -p ${db.port} -U ${db.user} -d ${db.database} -f "${sqlFile}"`,
          { env }
        );

        // Dateien kopieren
        const storageBackup = path.join(backupDir, "storage");
        try {
          await fs.access(storageBackup);
          await fs.rm(STORAGE_ROOT, { recursive: true, force: true });
          await execAsync(`cp -r "${storageBackup}" "${STORAGE_ROOT}"`);
        } catch {
          // Kein Storage-Backup vorhanden
        }

        await fs.rm(extractDir, { recursive: true, force: true });
        break;
      }
    }

    // Temporaere Datei aufraeumen
    await fs.unlink(tempFile);

    await prisma.restoreLog.update({
      where: { id: restoreLogId },
      data: {
        status: "completed",
        completedAt: new Date(),
      },
    });
  } catch (error) {
    await prisma.restoreLog.update({
      where: { id: restoreLogId },
      data: {
        status: "failed",
        errorMessage: error instanceof Error ? error.message : "Unbekannter Fehler",
        completedAt: new Date(),
      },
    });
    throw error;
  }
}
