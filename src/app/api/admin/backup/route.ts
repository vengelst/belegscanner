import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/require-auth";
import { createBackupSchema } from "@/lib/validation";
import { createBackup } from "@/lib/backup";

// GET: Liste aller Backups
export async function GET(request: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") ?? "1", 10);
  const limit = parseInt(searchParams.get("limit") ?? "20", 10);
  const status = searchParams.get("status");
  const type = searchParams.get("type");

  // Filter erstellen
  const where: {
    status?: string;
    type?: string;
  } = {};

  if (status) {
    where.status = status;
  }
  if (type) {
    where.type = type;
  }

  const [backups, total] = await Promise.all([
    prisma.backup.findMany({
      where,
      orderBy: { startedAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
        _count: {
          select: { restoreLogs: true },
        },
      },
    }),
    prisma.backup.count({ where }),
  ]);

  return NextResponse.json({
    backups: backups.map((backup) => ({
      id: backup.id,
      type: backup.type,
      status: backup.status,
      fileName: backup.fileName,
      fileSize: backup.fileSize,
      dbRecords: backup.dbRecords,
      filesCount: backup.filesCount,
      errorMessage: backup.errorMessage,
      triggeredBy: backup.triggeredBy,
      user: backup.user,
      restoreCount: backup._count.restoreLogs,
      startedAt: backup.startedAt,
      completedAt: backup.completedAt,
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}

// POST: Neues Backup manuell starten
export async function POST(request: NextRequest) {
  const { session, error } = await requireAdmin();
  if (error) return error;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const parsed = createBackupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validierungsfehler.", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  try {
    // Pruefen ob bereits ein Backup laeuft
    const runningBackup = await prisma.backup.findFirst({
      where: {
        status: { in: ["pending", "running"] },
      },
    });

    if (runningBackup) {
      return NextResponse.json(
        { error: "Es laeuft bereits ein Backup. Bitte warten Sie, bis es abgeschlossen ist." },
        { status: 409 }
      );
    }

    // Backup starten
    const backupId = await createBackup(parsed.data.type, "manual", session.userId);

    const backup = await prisma.backup.findUnique({
      where: { id: backupId },
    });

    return NextResponse.json(
      {
        message: "Backup wurde gestartet.",
        backup: {
          id: backup?.id,
          type: backup?.type,
          status: backup?.status,
          triggeredBy: backup?.triggeredBy,
          startedAt: backup?.startedAt,
        },
      },
      { status: 202 }
    );
  } catch (err) {
    console.error("Fehler beim Starten des Backups:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Backup konnte nicht gestartet werden." },
      { status: 500 }
    );
  }
}
