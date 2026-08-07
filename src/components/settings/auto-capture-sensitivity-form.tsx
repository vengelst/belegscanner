"use client";

import { useState } from "react";
import {
  AUTO_CAPTURE_OPTIONS,
  type AutoCaptureSensitivity,
  readAutoCaptureSensitivity,
  writeAutoCaptureSensitivity,
} from "@/lib/auto-capture-settings";
import { cn } from "@/lib/utils";

export function AutoCaptureSensitivityForm() {
  const [selected, setSelected] = useState<AutoCaptureSensitivity>(() => readAutoCaptureSensitivity());
  const [message, setMessage] = useState<string | null>(null);

  function handleSelect(next: AutoCaptureSensitivity) {
    writeAutoCaptureSensitivity(next);
    setSelected(next);
    setMessage("Gespeichert. Gilt beim nächsten Kamerastart auf diesem Gerät.");
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold tracking-tight">Auto-Capture Empfindlichkeit</h2>
        <p className="text-sm text-muted-foreground">
          Steuert, wie schnell die Kamera den Beleg automatisch aufnimmt. Speicherung nur auf diesem Gerät.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {AUTO_CAPTURE_OPTIONS.map((option) => {
          const isSelected = selected === option.id;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => handleSelect(option.id)}
              className={cn(
                "rounded-2xl border px-4 py-4 text-left transition",
                isSelected
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "border-border bg-background hover:border-primary/40",
              )}
            >
              <p className="text-sm font-semibold text-foreground">{option.label}</p>
              <p className="mt-1 text-xs text-muted-foreground">{option.description}</p>
            </button>
          );
        })}
      </div>
      {message ? <p className="text-sm text-primary">{message}</p> : null}
    </div>
  );
}
