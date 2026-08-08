"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SelectField } from "@/components/ui/select-field";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  cronToFriendlySchedule,
  describeBackupSchedule,
  friendlyScheduleToCron,
  type BackupFrequency,
} from "@/lib/backup/schedule-format";

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

const WEEKDAYS: Array<{ value: string; label: string }> = [
  { value: "1", label: "Montag" },
  { value: "2", label: "Dienstag" },
  { value: "3", label: "Mittwoch" },
  { value: "4", label: "Donnerstag" },
  { value: "5", label: "Freitag" },
  { value: "6", label: "Samstag" },
  { value: "0", label: "Sonntag" },
];

export function BackupScheduleForm({ config }: { config: ScheduleConfig }) {
  const initial = useMemo(() => cronToFriendlySchedule(config.scheduleCron), [config.scheduleCron]);
  const [enabled, setEnabled] = useState(config.scheduleEnabled);
  const [frequency, setFrequency] = useState<BackupFrequency>(initial.frequency);
  const [time, setTime] = useState(initial.time);
  const [weekday, setWeekday] = useState(initial.weekday);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleSubmit(formData: FormData) {
    setError(null);
    setSuccess(null);

    const nextFrequency = (formData.get("frequency") as BackupFrequency) || frequency;
    const nextTime = String(formData.get("time") || time);
    const nextWeekday = String(formData.get("weekday") || weekday);
    const cronExpression = friendlyScheduleToCron(nextFrequency, nextTime, nextWeekday);

    if (!cronExpression) {
      setError("Bitte eine gültige Uhrzeit im Format HH:MM eintragen.");
      return;
    }

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
      setSuccess(`Zeitplan gespeichert: ${describeBackupSchedule(nextFrequency, nextTime, nextWeekday)}.`);
      router.refresh();
    });
  }

  const nextRun = config.scheduler?.nextRun
    ? new Date(config.scheduler.nextRun).toLocaleString("de-DE")
    : null;

  return (
    <Card>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Automatische Backups</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Einfach Rhythmus und Uhrzeit einstellen – ohne Cron-Ausdruck.
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
            {initial.fromFallback ? (
              <p className="rounded-xl border border-accent/40 bg-accent/10 px-3 py-2 text-xs text-muted-foreground">
                Der bisherige Zeitplan war komplex hinterlegt und wurde hier auf täglich 02:00
                zurückgesetzt. Bitte Uhrzeit und Rhythmus neu wählen und speichern.
              </p>
            ) : null}

            <SelectField
              label="Rhythmus"
              name="frequency"
              value={frequency}
              onChange={(value) => setFrequency(value as BackupFrequency)}
            >
              <option value="daily">Täglich</option>
              <option value="weekly">Wöchentlich</option>
            </SelectField>

            {frequency === "weekly" ? (
              <SelectField
                label="Wochentag"
                name="weekday"
                value={weekday}
                onChange={setWeekday}
              >
                {WEEKDAYS.map((day) => (
                  <option key={day.value} value={day.value}>
                    {day.label}
                  </option>
                ))}
              </SelectField>
            ) : (
              <input type="hidden" name="weekday" value={weekday} />
            )}

            <Input
              label="Uhrzeit"
              name="time"
              type="time"
              required
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />

            <p className="text-sm text-muted-foreground">
              Geplant:{" "}
              <span className="font-medium text-foreground">
                {describeBackupSchedule(frequency, time, weekday)}
              </span>
            </p>

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
                Nächstes Backup: <span className="font-medium text-foreground">{nextRun}</span>
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
