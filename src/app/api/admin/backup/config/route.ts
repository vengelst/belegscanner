import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/require-auth";
import { backupConfigSchema } from "@/lib/validation";
import { encrypt } from "@/lib/encryption";
import { reloadScheduler, getSchedulerStatus, validateCronExpression } from "@/lib/backup";

// GET: Aktuelle Backup-Konfiguration
export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const config = await prisma.backupConfig.findUnique({
    where: { id: "singleton" },
  });

  const schedulerStatus = await getSchedulerStatus();

  if (!config) {
    return NextResponse.json({
      storageType: "local",
      localPath: "/app/storage/backups",
      s3Endpoint: null,
      s3Bucket: null,
      s3AccessKey: null,
      s3SecretKey: null,
      s3Region: null,
      scheduleEnabled: false,
      scheduleCron: "0 2 * * *",
      retentionDays: 30,
      scheduler: schedulerStatus,
    });
  }

  return NextResponse.json({
    storageType: config.storageType,
    localPath: config.localPath,
    s3Endpoint: config.s3Endpoint,
    s3Bucket: config.s3Bucket,
    s3AccessKey: config.s3AccessKey,
    s3SecretKey: config.s3SecretKeyEnc ? "********" : null,
    s3Region: config.s3Region,
    scheduleEnabled: config.scheduleEnabled,
    scheduleCron: config.scheduleCron,
    retentionDays: config.retentionDays,
    updatedAt: config.updatedAt,
    scheduler: schedulerStatus,
  });
}

// PUT: Backup-Konfiguration aktualisieren
export async function PUT(request: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungueltiger Request-Body." }, { status: 400 });
  }

  const parsed = backupConfigSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validierungsfehler.", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  // Cron-Expression validieren
  if (!validateCronExpression(parsed.data.scheduleCron)) {
    return NextResponse.json(
      { error: "Ungueltige Cron-Expression.", details: { scheduleCron: ["Ungueltige Cron-Expression"] } },
      { status: 400 }
    );
  }

  const existing = await prisma.backupConfig.findUnique({
    where: { id: "singleton" },
  });

  // S3 Secret Key Handling: nur aktualisieren wenn nicht "********"
  let s3SecretKeyEnc = existing?.s3SecretKeyEnc ?? null;
  if (parsed.data.s3SecretKey && parsed.data.s3SecretKey !== "********") {
    s3SecretKeyEnc = encrypt(parsed.data.s3SecretKey);
  }

  // Bei Wechsel auf S3: Secret Key muss vorhanden sein
  if (parsed.data.storageType === "s3" && !s3SecretKeyEnc && !parsed.data.s3SecretKey) {
    return NextResponse.json(
      { error: "S3-Secret-Key ist bei S3-Storage erforderlich." },
      { status: 400 }
    );
  }

  const config = await prisma.backupConfig.upsert({
    where: { id: "singleton" },
    update: {
      storageType: parsed.data.storageType,
      localPath: parsed.data.localPath,
      s3Endpoint: parsed.data.s3Endpoint ?? null,
      s3Bucket: parsed.data.s3Bucket ?? null,
      s3AccessKey: parsed.data.s3AccessKey ?? null,
      s3SecretKeyEnc,
      s3Region: parsed.data.s3Region ?? null,
      scheduleEnabled: parsed.data.scheduleEnabled,
      scheduleCron: parsed.data.scheduleCron,
      retentionDays: parsed.data.retentionDays,
    },
    create: {
      id: "singleton",
      storageType: parsed.data.storageType,
      localPath: parsed.data.localPath,
      s3Endpoint: parsed.data.s3Endpoint ?? null,
      s3Bucket: parsed.data.s3Bucket ?? null,
      s3AccessKey: parsed.data.s3AccessKey ?? null,
      s3SecretKeyEnc,
      s3Region: parsed.data.s3Region ?? null,
      scheduleEnabled: parsed.data.scheduleEnabled,
      scheduleCron: parsed.data.scheduleCron,
      retentionDays: parsed.data.retentionDays,
    },
  });

  // Scheduler neu laden nach Konfigurations-Aenderung
  await reloadScheduler();
  const schedulerStatus = await getSchedulerStatus();

  return NextResponse.json({
    storageType: config.storageType,
    localPath: config.localPath,
    s3Endpoint: config.s3Endpoint,
    s3Bucket: config.s3Bucket,
    s3AccessKey: config.s3AccessKey,
    s3SecretKey: config.s3SecretKeyEnc ? "********" : null,
    s3Region: config.s3Region,
    scheduleEnabled: config.scheduleEnabled,
    scheduleCron: config.scheduleCron,
    retentionDays: config.retentionDays,
    updatedAt: config.updatedAt,
    scheduler: schedulerStatus,
  });
}
