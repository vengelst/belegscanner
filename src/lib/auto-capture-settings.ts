export type AutoCaptureSensitivity = "off" | "slow" | "normal" | "fast";

export const AUTO_CAPTURE_STORAGE_KEY = "belegscanner.autoCaptureSensitivity";
export const AUTO_CAPTURE_DEFAULT: AutoCaptureSensitivity = "slow";

export type AutoCaptureProfile = {
  enabled: boolean;
  /** Wie lange der Beleg stabil erkannt sein muss, bevor ausgelöst wird. */
  holdMs: number;
  /** Nach Kamera-Start erst nach dieser Zeit Auto-Capture erlauben. */
  warmupMs: number;
  /** Toleranz für kurzzeitig verlorene Erkennung während des Countdowns. */
  missGraceMs: number;
  /** Nur bei status === "ready" auslösen (strengere Qualitätsprüfung). */
  requireReadyStatus: boolean;
};

const PROFILES: Record<AutoCaptureSensitivity, AutoCaptureProfile> = {
  off: {
    enabled: false,
    holdMs: 0,
    warmupMs: 0,
    missGraceMs: 0,
    requireReadyStatus: true,
  },
  slow: {
    enabled: true,
    holdMs: 1600,
    warmupMs: 2500,
    missGraceMs: 450,
    requireReadyStatus: true,
  },
  normal: {
    enabled: true,
    holdMs: 900,
    warmupMs: 1500,
    missGraceMs: 700,
    requireReadyStatus: false,
  },
  fast: {
    enabled: true,
    holdMs: 400,
    warmupMs: 500,
    missGraceMs: 900,
    requireReadyStatus: false,
  },
};

export function isAutoCaptureSensitivity(value: unknown): value is AutoCaptureSensitivity {
  return value === "off" || value === "slow" || value === "normal" || value === "fast";
}

export function getAutoCaptureProfile(sensitivity: AutoCaptureSensitivity): AutoCaptureProfile {
  return PROFILES[sensitivity];
}

export function readAutoCaptureSensitivity(): AutoCaptureSensitivity {
  if (typeof window === "undefined") return AUTO_CAPTURE_DEFAULT;
  try {
    const raw = window.localStorage.getItem(AUTO_CAPTURE_STORAGE_KEY);
    if (isAutoCaptureSensitivity(raw)) return raw;
  } catch {
    // private mode / blocked storage
  }
  return AUTO_CAPTURE_DEFAULT;
}

export function writeAutoCaptureSensitivity(value: AutoCaptureSensitivity) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(AUTO_CAPTURE_STORAGE_KEY, value);
}

export const AUTO_CAPTURE_OPTIONS: Array<{
  id: AutoCaptureSensitivity;
  label: string;
  description: string;
}> = [
  {
    id: "off",
    label: "Aus",
    description: "Nur manuell oder per Tippen aufnehmen – kein Auto-Capture.",
  },
  {
    id: "slow",
    label: "Langsam (empfohlen)",
    description: "Wartet länger, bis der Beleg ruhig und vollständig im Bild ist.",
  },
  {
    id: "normal",
    label: "Normal",
    description: "Ausgewogene Erkennung – schneller als Langsam, aber nicht sofort.",
  },
  {
    id: "fast",
    label: "Schnell",
    description: "Löscht früh aus – nur wenn du den Beleg sehr ruhig halten kannst.",
  },
];
