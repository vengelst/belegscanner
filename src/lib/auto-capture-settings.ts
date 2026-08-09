export type AutoCaptureSensitivity = "off" | "slow" | "normal" | "fast";

export const AUTO_CAPTURE_STORAGE_KEY = "belegscanner.autoCaptureSensitivity";
/** Normal: Beleg erkannt → nach kurzem Hold auslösen (ohne perfekten Ready-Status). */
export const AUTO_CAPTURE_DEFAULT: AutoCaptureSensitivity = "normal";

export type AutoCaptureProfile = {
  enabled: boolean;
  /** Wie lange der Beleg stabil erkannt sein muss, bevor ausgelöst wird. */
  holdMs: number;
  /** Nach Kamera-Start erst nach dieser Zeit Auto-Capture erlauben. */
  warmupMs: number;
  /** Toleranz für kurzzeitig verlorene Erkennung während des Countdowns. */
  missGraceMs: number;
  /**
   * Nur bei status === "ready" auslösen.
   * Standardmaessig aus: sobald Bounds/Beleg erkannt sind, reicht das.
   */
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
    holdMs: 1400,
    warmupMs: 1200,
    missGraceMs: 800,
    // Langsam = laengerer Hold, nicht strengere Qualitaet.
    requireReadyStatus: false,
  },
  normal: {
    enabled: true,
    holdMs: 700,
    warmupMs: 800,
    missGraceMs: 900,
    requireReadyStatus: false,
  },
  fast: {
    enabled: true,
    holdMs: 350,
    warmupMs: 400,
    missGraceMs: 1000,
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
    label: "Langsam",
    description: "Wartet länger nach der Erkennung, bevor automatisch ausgelöst wird.",
  },
  {
    id: "normal",
    label: "Normal (empfohlen)",
    description: "Sobald der Beleg erkannt ist, kurze Pause – dann Auto-Aufnahme.",
  },
  {
    id: "fast",
    label: "Schnell",
    description: "Löst früh aus, sobald der Beleg im Bild erkannt wird.",
  },
];
