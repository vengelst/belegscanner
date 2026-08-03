"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/dialog";
import { RestoreDialog } from "./restore-dialog";

type BackupEntry = {
  id: string;
  type: "full" | "database" | "files";
  status: "pending" | "running" | "completed" | "failed";
  fileName: string | null;
  fileSize: number | null;
  dbRecords: number | null;
  filesCount: number | null;
  errorMessage: string | null;
  triggeredBy: "manual" | "scheduled";
  user: { id: string; name: string | null; email: string } | null;
  restoreCount: number;
  startedAt: string;
  completedAt: string | null;
};

type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

type BackupHistoryTableProps = {
  backups: BackupEntry[];
  pagination: Pagination;
};

function formatBytes(bytes: number | null): string {
  if (!bytes) return "-";
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatDate(date: string | null): string {
  if (!date) return "-";
  return new Date(date).toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getStatusBadge(status: BackupEntry["status"]) {
  switch (status) {
    case "completed":
      return <Badge variant="success">Abgeschlossen</Badge>;
    case "running":
      return (
        <Badge variant="warning">
          <span className="mr-1.5 inline-block h-2 w-2 animate-pulse rounded-full bg-current" />
          Laeuft
        </Badge>
      );
    case "pending":
      return <Badge variant="default">Wartet</Badge>;
    case "failed":
      return <Badge variant="danger">Fehlgeschlagen</Badge>;
  }
}

function getTypeLabel(type: BackupEntry["type"]) {
  switch (type) {
    case "full":
      return "Vollstaendig";
    case "database":
      return "Datenbank";
    case "files":
      return "Dateien";
  }
}

export function BackupHistoryTable({ backups, pagination }: BackupHistoryTableProps) {
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [restoreBackup, setRestoreBackup] = useState<BackupEntry | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const searchParams = useSearchParams();

  function handleDelete() {
    if (!deleteId) return;

    startTransition(async () => {
      const res = await fetch(`/api/admin/backup/${deleteId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setDeleteId(null);
        router.refresh();
      }
    });
  }

  function handleDownload(backupId: string) {
    window.open(`/api/admin/backup/${backupId}/download`, "_blank");
  }

  function goToPage(page: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(page));
    router.push(`?${params.toString()}`);
  }

  return (
    <Card className="overflow-hidden p-0">
      <div className="p-6 pb-4">
        <h2 className="text-lg font-semibold tracking-tight">Backup-Historie</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Uebersicht aller erstellten Backups.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[800px] text-sm">
          <thead>
            <tr className="border-t border-border bg-muted/30">
              <th className="px-6 py-3 text-left font-medium text-muted-foreground">Datum</th>
              <th className="px-6 py-3 text-left font-medium text-muted-foreground">Typ</th>
              <th className="px-6 py-3 text-left font-medium text-muted-foreground">Status</th>
              <th className="px-6 py-3 text-left font-medium text-muted-foreground">Groesse</th>
              <th className="px-6 py-3 text-left font-medium text-muted-foreground">Ausgeloest</th>
              <th className="px-6 py-3 text-right font-medium text-muted-foreground">Aktionen</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {backups.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-muted-foreground">
                  Keine Backups vorhanden.
                </td>
              </tr>
            ) : (
              backups.map((backup) => (
                <tr key={backup.id} className="hover:bg-muted/20">
                  <td className="px-6 py-4">
                    <div className="font-medium">{formatDate(backup.startedAt)}</div>
                    {backup.completedAt && backup.completedAt !== backup.startedAt && (
                      <div className="text-xs text-muted-foreground">
                        Fertig: {formatDate(backup.completedAt)}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-medium">{getTypeLabel(backup.type)}</div>
                    {backup.dbRecords != null && (
                      <div className="text-xs text-muted-foreground">
                        {backup.dbRecords.toLocaleString("de-DE")} DB-Eintraege
                      </div>
                    )}
                    {backup.filesCount != null && (
                      <div className="text-xs text-muted-foreground">
                        {backup.filesCount.toLocaleString("de-DE")} Dateien
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {getStatusBadge(backup.status)}
                    {backup.errorMessage && (
                      <div className="mt-1 text-xs text-danger">{backup.errorMessage}</div>
                    )}
                  </td>
                  <td className="px-6 py-4">{formatBytes(backup.fileSize)}</td>
                  <td className="px-6 py-4">
                    <div className="font-medium">
                      {backup.triggeredBy === "manual" ? "Manuell" : "Geplant"}
                    </div>
                    {backup.user && (
                      <div className="text-xs text-muted-foreground">
                        {backup.user.name ?? backup.user.email}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex justify-end gap-2">
                      {backup.status === "completed" && backup.fileName && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDownload(backup.id)}
                          >
                            Download
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setRestoreBackup(backup)}
                          >
                            Restore
                          </Button>
                        </>
                      )}
                      <Button
                        variant="danger-outline"
                        size="sm"
                        onClick={() => setDeleteId(backup.id)}
                        disabled={backup.status === "running" || backup.status === "pending"}
                      >
                        Loeschen
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-border px-6 py-4">
          <p className="text-sm text-muted-foreground">
            {pagination.total} Backups insgesamt
          </p>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => goToPage(pagination.page - 1)}
              disabled={pagination.page <= 1}
            >
              Zurueck
            </Button>
            <span className="flex items-center px-3 text-sm">
              Seite {pagination.page} von {pagination.totalPages}
            </span>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => goToPage(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages}
            >
              Weiter
            </Button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Backup loeschen"
        message="Moechten Sie dieses Backup wirklich loeschen? Die Backup-Datei wird unwiderruflich entfernt."
        confirmLabel="Loeschen"
        variant="danger"
        loading={isPending}
      />

      <RestoreDialog
        open={!!restoreBackup}
        onClose={() => setRestoreBackup(null)}
        backup={
          restoreBackup
            ? {
                id: restoreBackup.id,
                type: restoreBackup.type,
                fileName: restoreBackup.fileName ?? "",
                fileSize: restoreBackup.fileSize ?? 0,
                completedAt: restoreBackup.completedAt ?? restoreBackup.startedAt,
              }
            : null
        }
      />
    </Card>
  );
}
