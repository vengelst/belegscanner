import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-auth";
import { downloadBackup } from "@/lib/backup";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET: Backup-Datei herunterladen
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;

  try {
    const { data, fileName } = await downloadBackup(id);

    // Content-Type basierend auf Dateiendung
    let contentType = "application/octet-stream";
    if (fileName.endsWith(".tar.gz")) {
      contentType = "application/gzip";
    } else if (fileName.endsWith(".sql.gz")) {
      contentType = "application/gzip";
    } else if (fileName.endsWith(".sql")) {
      contentType = "application/sql";
    }

    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Content-Length": data.length.toString(),
      },
    });
  } catch (err) {
    console.error("Fehler beim Herunterladen des Backups:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Backup konnte nicht heruntergeladen werden." },
      { status: 500 }
    );
  }
}
