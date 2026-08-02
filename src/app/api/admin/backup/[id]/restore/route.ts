import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/require-auth";
import { startRestore } from "@/lib/backup";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST: Wiederherstellung aus Backup starten
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { session, error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;

  try {
    // Pruefen ob Backup existiert und verfuegbar ist
    const backup = await prisma.backup.findUnique({
      where: { id },
    });

    if (!backup) {
      return NextResponse.json({ error: "Backup nicht gefunden." }, { status: 404 });
    }

    if (backup.status !== "completed") {
      return NextResponse.json(
        { error: "Nur abgeschlossene Backups koennen wiederhergestellt werden." },
        { status: 400 }
      );
    }

    if (!backup.fileName) {
      return NextResponse.json(
        { error: "Backup-Datei ist nicht verfuegbar." },
        { status: 400 }
      );
    }

    // Pruefen ob bereits eine Wiederherstellung laeuft
    const runningRestore = await prisma.restoreLog.findFirst({
      where: {
        status: { in: ["pending", "running"] },
      },
    });

    if (runningRestore) {
      return NextResponse.json(
        { error: "Es laeuft bereits eine Wiederherstellung. Bitte warten Sie, bis sie abgeschlossen ist." },
        { status: 409 }
      );
    }

    // Wiederherstellung starten
    const restoreLogId = await startRestore(id, session.userId);

    const restoreLog = await prisma.restoreLog.findUnique({
      where: { id: restoreLogId },
    });

    return NextResponse.json(
      {
        message: "Wiederherstellung wurde gestartet.",
        restore: {
          id: restoreLog?.id,
          backupId: restoreLog?.backupId,
          status: restoreLog?.status,
          startedAt: restoreLog?.startedAt,
        },
      },
      { status: 202 }
    );
  } catch (err) {
    console.error("Fehler beim Starten der Wiederherstellung:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Wiederherstellung konnte nicht gestartet werden." },
      { status: 500 }
    );
  }
}
