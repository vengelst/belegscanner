import { describe, expect, it } from "vitest";
import {
  cronToFriendlySchedule,
  friendlyScheduleToCron,
} from "@/lib/backup/schedule-format";

describe("backup schedule friendly mapping", () => {
  it("wandelt taegliche Cron in Uhrzeit um", () => {
    expect(cronToFriendlySchedule("0 2 * * *")).toEqual({
      frequency: "daily",
      time: "02:00",
      weekday: "1",
      fromFallback: false,
    });
  });

  it("wandelt woechentliche Cron in Wochentag + Uhrzeit um", () => {
    expect(cronToFriendlySchedule("30 14 * * 3")).toEqual({
      frequency: "weekly",
      time: "14:30",
      weekday: "3",
      fromFallback: false,
    });
  });

  it("baut Cron aus Uhrzeit", () => {
    expect(friendlyScheduleToCron("daily", "02:15", "1")).toBe("15 2 * * *");
    expect(friendlyScheduleToCron("weekly", "09:05", "0")).toBe("5 9 * * 0");
  });

  it("lehnt ungueltige Uhrzeiten ab", () => {
    expect(friendlyScheduleToCron("daily", "25:00", "1")).toBeNull();
  });
});
