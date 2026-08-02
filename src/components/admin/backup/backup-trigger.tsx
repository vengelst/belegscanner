"use client";

import { useState, useTransition, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type RunningBackup = {
  id: string;
  type: string;
  status: string;
  startedAt: string;
} | null;

export function BackupTrigger({ runningBackup }: { runningBackup: RunningBackup }) {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [currentBackup, setCurrentBackup] = useState<RunningBackup>(runningBackup);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const pollBackupStatus = useCallback(async () => {
    if (!currentBackup) return;

    const res = await fetch(`/api/admin/backup/${currentBackup.id}`);
    if (res.ok) {
      const data = await res.json();
      if (data.status === "completed") {
        setCurrentBackup(null);
        setSuccess("Backup wurde erfolgreich erstellt.");
        router.refresh();
      } else if (data.status === "failed") {
        setCurrentBackup(null);
        setError(data.errorMessage ?? "Backup ist fehlgeschlagen.");
        router.refresh();
      }
    }
  }, [currentBackup, router]);

  useEffect(() => {
    if (!currentBackup) return;

    const interval = setInterval(pollBackupStatus, 3000);
    return () => clearInterval(interval);
  }, [currentBackup, pollBackupStatus]);

  function triggerBackup(type: "full" | "database" | "files") {
    setError(null);
    setSuccess(null);

    startTransition(async () => {
      const res = await fetch("/api/admin/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Backup konnte nicht gestartet werden.");
        return;
      }

      setCurrentBackup(data.backup);
      router.refresh();
    });
  }

  const isRunning = !!currentBackup;

  return (
    <Card>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Manuelles Backup</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Backup jetzt manuell starten.
          </p>
        </div>
        {isRunning && (
          <Badge variant="warning">
            <span className="mr-1.5 inline-block h-2 w-2 animate-pulse rounded-full bg-current" />
            Backup laeuft...
          </Badge>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <Button
          onClick={() => triggerBackup("full")}
          disabled={isPending || isRunning}
          loading={isPending && !isRunning}
        >
          Vollstaendiges Backup
        </Button>
        <Button
          variant="secondary"
          onClick={() => triggerBackup("database")}
          disabled={isPending || isRunning}
        >
          Nur Datenbank
        </Button>
        <Button
          variant="secondary"
          onClick={() => triggerBackup("files")}
          disabled={isPending || isRunning}
        >
          Nur Dateien
        </Button>
      </div>

      {isRunning && currentBackup && (
        <div className="mt-4 rounded-xl bg-muted/50 p-4">
          <p className="text-sm">
            <span className="font-medium">Typ:</span>{" "}
            {currentBackup.type === "full" ? "Vollstaendig" : currentBackup.type === "database" ? "Datenbank" : "Dateien"}
          </p>
          <p className="text-sm text-muted-foreground">
            Gestartet: {new Date(currentBackup.startedAt).toLocaleString("de-DE")}
          </p>
        </div>
      )}

      {error && <p className="mt-4 text-sm font-medium text-danger">{error}</p>}
      {success && <p className="mt-4 text-sm font-medium text-primary">{success}</p>}
    </Card>
  );
}
