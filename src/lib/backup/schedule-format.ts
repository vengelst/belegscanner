export type BackupFrequency = "daily" | "weekly";

export type ParsedBackupSchedule = {
  frequency: BackupFrequency;
  time: string;
  weekday: string;
  /** true, wenn der gespeicherte Cron nicht als einfache Zeit darstellbar war. */
  fromFallback: boolean;
};

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

/** Wandelt Cron in Uhrzeit + Rhythmus um; bei komplexen Ausdrücken Fallback 02:00 täglich. */
export function cronToFriendlySchedule(cron: string): ParsedBackupSchedule {
  const parts = cron.trim().split(/\s+/);
  if (parts.length < 5) {
    return { frequency: "daily", time: "02:00", weekday: "1", fromFallback: true };
  }

  const minute = Number(parts[0]);
  const hour = Number(parts[1]);
  const dayOfMonth = parts[2];
  const month = parts[3];
  const dayOfWeek = parts[4];

  if (
    !Number.isInteger(minute)
    || !Number.isInteger(hour)
    || minute < 0
    || minute > 59
    || hour < 0
    || hour > 23
    || dayOfMonth !== "*"
    || month !== "*"
  ) {
    return { frequency: "daily", time: "02:00", weekday: "1", fromFallback: true };
  }

  const time = `${pad2(hour)}:${pad2(minute)}`;

  if (dayOfWeek === "*") {
    return { frequency: "daily", time, weekday: "1", fromFallback: false };
  }

  if (/^[0-6]$/.test(dayOfWeek)) {
    return { frequency: "weekly", time, weekday: dayOfWeek, fromFallback: false };
  }

  return { frequency: "daily", time: "02:00", weekday: "1", fromFallback: true };
}

export function friendlyScheduleToCron(
  frequency: BackupFrequency,
  time: string,
  weekday: string,
): string | null {
  const match = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(time.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (frequency === "weekly") {
    if (!/^[0-6]$/.test(weekday)) return null;
    return `${minute} ${hour} * * ${weekday}`;
  }
  return `${minute} ${hour} * * *`;
}

export function describeBackupSchedule(
  frequency: BackupFrequency,
  time: string,
  weekday: string,
): string {
  const weekdays: Record<string, string> = {
    "0": "Sonntag",
    "1": "Montag",
    "2": "Dienstag",
    "3": "Mittwoch",
    "4": "Donnerstag",
    "5": "Freitag",
    "6": "Samstag",
  };
  if (frequency === "weekly") {
    return `Jeden ${weekdays[weekday] ?? "Sonntag"} um ${time} Uhr`;
  }
  return `Täglich um ${time} Uhr`;
}
