import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/require-auth";
import { deleteBackup } from "@/lib/backup";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET: Backup-Details abrufen
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;

  const backup = await prisma.backup.findUnique({
    where: { id },
    include: {
      user: {
        select: { id: true, name: true, email: true },
      },
      restoreLogs: {
        orderBy: { startedAt: "desc" },
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
        },
      },
    },
  });

  if (!backup) {
    return NextResponse.json({ error: "Backup nicht gefunden." }, { status: 404 });
  }

  return NextResponse.json({
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
    startedAt: backup.startedAt,
    completedAt: backup.completedAt,
    restoreLogs: backup.restoreLogs.map((log) => ({
      id: log.id,
      status: log.status,
      errorMessage: log.errorMessage,
      user: log.user,
      startedAt: log.startedAt,
      completedAt: log.completedAt,
    })),
  });
}

// DELETE: Backup loeschen
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;

  try {
    // Pruefen ob Backup existiert
    const backup = await prisma.backup.findUnique({
      where: { id },
    });

    if (!backup) {
      return NextResponse.json({ error: "Backup nicht gefunden." }, { status: 404 });
    }

    // Pruefen ob Backup noch laeuft
    if (backup.status === "pending" || backup.status === "running") {
      return NextResponse.json(
        { error: "Laufende Backups koennen nicht geloescht werden." },
        { status: 409 }
      );
    }

    // Backup loeschen (Datei + DB-Eintrag)
    await deleteBackup(id);

    return NextResponse.json({ message: "Backup wurde geloescht." });
  } catch (err) {
    console.error("Fehler beim Loeschen des Backups:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Backup konnte nicht geloescht werden." },
      { status: 500 }
    );
  }
}
