"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SelectField } from "@/components/ui/select-field";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type ScheduleConfig = {
  scheduleEnabled: boolean;
  scheduleCron: string;
  retentionDays: number;
  scheduler?: {
    enabled: boolean;
    cronExpression: string;
    nextRun: Date | null;
    isRunning: boolean;
  };
};

type SchedulePreset = "custom" | "daily-2" | "daily-3" | "weekly-sun" | "weekly-sat";

function cronToPreset(cron: string): SchedulePreset {
  if (cron === "0 2 * * *") return "daily-2";
  if (cron === "0 3 * * *") return "daily-3";
  if (cron === "0 2 * * 0") return "weekly-sun";
  if (cron === "0 2 * * 6") return "weekly-sat";
  return "custom";
}

function presetToCron(preset: SchedulePreset): string {
  switch (preset) {
    case "daily-2": return "0 2 * * *";
    case "daily-3": return "0 3 * * *";
    case "weekly-sun": return "0 2 * * 0";
    case "weekly-sat": return "0 2 * * 6";
    default: return "0 2 * * *";
  }
}

export function BackupScheduleForm({ config }: { config: ScheduleConfig }) {
  const [enabled, setEnabled] = useState(config.scheduleEnabled);
  const [preset, setPreset] = useState<SchedulePreset>(cronToPreset(config.scheduleCron));
  const [customCron, setCustomCron] = useState(config.scheduleCron);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleSubmit(formData: FormData) {
    setError(null);
    setSuccess(null);

    const schedulePreset = formData.get("schedulePreset") as SchedulePreset;
    const cronExpression = schedulePreset === "custom"
      ? formData.get("customCron") as string
      : presetToCron(schedulePreset);

    startTransition(async () => {
      const res = await fetch("/api/admin/backup/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scheduleEnabled: formData.get("enabled") === "on",
          scheduleCron: cronExpression,
          retentionDays: Number(formData.get("retentionDays")),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Fehler beim Speichern des Zeitplans.");
        return;
      }
      setSuccess("Zeitplan wurde gespeichert.");
      router.refresh();
    });
  }

  const nextRun = config.scheduler?.nextRun
    ? config.scheduler.nextRun.toLocaleString("de-DE")
    : null;

  return (
    <Card>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Automatische Backups</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Zeitplan fuer automatische Backups konfigurieren.
          </p>
        </div>
        {config.scheduler?.enabled ? (
          <Badge variant="success">Aktiv</Badge>
        ) : (
          <Badge variant="default">Inaktiv</Badge>
        )}
      </div>

      <form action={handleSubmit} className="mt-4 space-y-4">
        <label className="flex items-center gap-3 text-sm font-medium">
          <input
            type="checkbox"
            name="enabled"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="h-4 w-4 rounded border-border accent-primary"
          />
          Automatische Backups aktivieren
        </label>

        {enabled && (
          <>
            <SelectField
              label="Zeitplan"
              name="schedulePreset"
              value={preset}
              onChange={(value) => setPreset(value as SchedulePreset)}
            >
              <option value="daily-2">Taeglich um 02:00 Uhr</option>
              <option value="daily-3">Taeglich um 03:00 Uhr</option>
              <option value="weekly-sun">Woechentlich (Sonntag 02:00 Uhr)</option>
              <option value="weekly-sat">Woechentlich (Samstag 02:00 Uhr)</option>
              <option value="custom">Benutzerdefiniert (Cron)</option>
            </SelectField>

            {preset === "custom" && (
              <Input
                label="Cron-Ausdruck"
                name="customCron"
                required
                placeholder="0 2 * * *"
                value={customCron}
                onChange={(e) => setCustomCron(e.target.value)}
              />
            )}

            <Input
              label="Aufbewahrungsdauer (Tage)"
              name="retentionDays"
              type="number"
              required
              min={1}
              max={365}
              defaultValue={String(config.retentionDays)}
            />

            {nextRun && (
              <p className="text-sm text-muted-foreground">
                Naechstes Backup: <span className="font-medium text-foreground">{nextRun}</span>
              </p>
            )}
          </>
        )}

        <div className="flex items-center gap-4 pt-2">
          <Button type="submit" loading={isPending}>
            Speichern
          </Button>
          {error && <p className="text-sm font-medium text-danger">{error}</p>}
          {success && <p className="text-sm font-medium text-primary">{success}</p>}
        </div>
      </form>
    </Card>
  );
}
