import { prisma } from "@/lib/prisma";
import { createBackup, cleanupOldBackups } from "./backup-service";

// Typ fuer node-cron Job
type CronJob = {
  stop: () => void;
  start: () => void;
};

// Aktiver Scheduler-Job
let scheduledJob: CronJob | null = null;

// Cron-Expression validieren
export function validateCronExpression(expression: string): boolean {
  // Einfache Validierung: 5 oder 6 Felder, getrennt durch Leerzeichen
  const parts = expression.trim().split(/\s+/);
  if (parts.length < 5 || parts.length > 6) {
    return false;
  }

  // Jedes Feld auf gueltiges Format pruefen
  const fieldPatterns = [
    /^(\*|([0-5]?\d)([-/]([0-5]?\d))*)$/, // Minute (0-59)
    /^(\*|([01]?\d|2[0-3])([-/]([01]?\d|2[0-3]))*)$/, // Stunde (0-23)
    /^(\*|([1-9]|[12]\d|3[01])([-/]([1-9]|[12]\d|3[01]))*)$/, // Tag (1-31)
    /^(\*|(1[0-2]|[1-9])([-/](1[0-2]|[1-9]))*)$/, // Monat (1-12)
    /^(\*|[0-7]([-/][0-7])*)$/, // Wochentag (0-7)
  ];

  for (let i = 0; i < 5 && i < parts.length; i++) {
    if (!fieldPatterns[i].test(parts[i])) {
      return false;
    }
  }

  return true;
}

// Naechste Ausfuehrungszeit berechnen
export function getNextExecutionTime(cronExpression: string): Date | null {
  try {
    // Dynamisch importieren um Fehler zu vermeiden wenn node-cron nicht verfuegbar
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const cronParser = require("cron-parser");
    const interval = cronParser.parseExpression(cronExpression);
    return interval.next().toDate();
  } catch {
    return null;
  }
}

// Scheduler starten
export async function startScheduler(): Promise<void> {
  // Vorherigen Job stoppen falls vorhanden
  if (scheduledJob) {
    scheduledJob.stop();
    scheduledJob = null;
  }

  const config = await prisma.backupConfig.findUnique({
    where: { id: "singleton" },
  });

  if (!config?.scheduleEnabled) {
    console.log("Backup-Scheduler ist deaktiviert.");
    return;
  }

  if (!validateCronExpression(config.scheduleCron)) {
    console.error(`Ungueltige Cron-Expression: ${config.scheduleCron}`);
    return;
  }

  try {
    // node-cron dynamisch importieren
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const cron = require("node-cron");

    scheduledJob = cron.schedule(
      config.scheduleCron,
      async () => {
        console.log("Starte geplantes Backup...");
        try {
          // Vollstaendiges Backup erstellen
          const backupId = await createBackup("full", "scheduled");
          console.log(`Geplantes Backup erfolgreich: ${backupId}`);

          // Alte Backups aufraeumen
          const deletedCount = await cleanupOldBackups();
          if (deletedCount > 0) {
            console.log(`${deletedCount} alte Backup(s) geloescht.`);
          }
        } catch (error) {
          console.error("Geplantes Backup fehlgeschlagen:", error);
        }
      },
      {
        scheduled: true,
        timezone: "Europe/Berlin",
      }
    );

    const nextRun = getNextExecutionTime(config.scheduleCron);
    console.log(
      `Backup-Scheduler gestartet. Cron: ${config.scheduleCron}, ` +
        `Naechste Ausfuehrung: ${nextRun?.toLocaleString("de-DE") ?? "unbekannt"}`
    );
  } catch (error) {
    console.error("Fehler beim Starten des Schedulers:", error);
  }
}

// Scheduler stoppen
export function stopScheduler(): void {
  if (scheduledJob) {
    scheduledJob.stop();
    scheduledJob = null;
    console.log("Backup-Scheduler gestoppt.");
  }
}

// Scheduler neu laden (nach Konfigurations-Aenderung)
export async function reloadScheduler(): Promise<void> {
  console.log("Lade Backup-Scheduler neu...");
  await startScheduler();
}

// Status des Schedulers abfragen
export async function getSchedulerStatus(): Promise<{
  enabled: boolean;
  cronExpression: string;
  nextRun: Date | null;
  isRunning: boolean;
}> {
  const config = await prisma.backupConfig.findUnique({
    where: { id: "singleton" },
  });

  const cronExpression = config?.scheduleCron ?? "0 2 * * *";

  return {
    enabled: config?.scheduleEnabled ?? false,
    cronExpression,
    nextRun: config?.scheduleEnabled ? getNextExecutionTime(cronExpression) : null,
    isRunning: scheduledJob !== null,
  };
}
