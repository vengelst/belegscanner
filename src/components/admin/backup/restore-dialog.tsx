"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type BackupInfo = {
  id: string;
  type: string;
  fileName: string;
  fileSize: number;
  completedAt: string;
};

type RestoreDialogProps = {
  open: boolean;
  onClose: () => void;
  backup: BackupInfo | null;
};

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function RestoreDialog({ open, onClose, backup }: RestoreDialogProps) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  if (!backup) return null;

  function handleRestore() {
    if (!backup) return;

    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/admin/backup/${backup.id}/restore`, {
        method: "POST",
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Wiederherstellung konnte nicht gestartet werden.");
        return;
      }

      onClose();
      router.refresh();
    });
  }

  const typeLabel =
    backup.type === "full"
      ? "Vollstaendig"
      : backup.type === "database"
        ? "Datenbank"
        : "Dateien";

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Backup wiederherstellen"
      description="Sind Sie sicher, dass Sie dieses Backup wiederherstellen moechten? Dieser Vorgang kann nicht rueckgaengig gemacht werden."
    >
      <div className="space-y-4">
        <div className="rounded-xl bg-muted/50 p-4 text-sm">
          <p>
            <span className="font-medium">Backup-Typ:</span> {typeLabel}
          </p>
          <p>
            <span className="font-medium">Datei:</span> {backup.fileName}
          </p>
          <p>
            <span className="font-medium">Groesse:</span> {formatBytes(backup.fileSize)}
          </p>
          <p>
            <span className="font-medium">Erstellt:</span>{" "}
            {new Date(backup.completedAt).toLocaleString("de-DE")}
          </p>
        </div>

        <div className="rounded-xl border border-danger/30 bg-danger/5 p-4">
          <p className="text-sm font-medium text-danger">Achtung</p>
          <p className="mt-1 text-sm text-danger/80">
            {backup.type === "full" || backup.type === "database"
              ? "Die aktuelle Datenbank wird ueberschrieben. Alle Aenderungen seit diesem Backup gehen verloren."
              : "Die aktuellen Dateien werden ueberschrieben."}
          </p>
        </div>

        {error && <p className="text-sm font-medium text-danger">{error}</p>}

        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose} disabled={isPending}>
            Abbrechen
          </Button>
          <Button variant="danger" onClick={handleRestore} loading={isPending}>
            Wiederherstellen
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
