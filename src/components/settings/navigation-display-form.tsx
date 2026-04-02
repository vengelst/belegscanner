"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import {
  NAVIGATION_DISPLAY_STORAGE_KEY,
  type NavigationDisplayMode,
} from "@/components/layout/navigation-config";
import { cn } from "@/lib/utils";

const options: Array<{
  value: NavigationDisplayMode;
  title: string;
  description: string;
}> = [
  {
    value: "icons",
    title: "Nur Symbole",
    description: "Zeigt die Menuepunkte kompakt nur mit farbigen Symbolen an.",
  },
  {
    value: "text",
    title: "Text + Symbol",
    description: "Zeigt die Menuepunkte mit Beschriftung und Symbol an.",
  },
];

export function NavigationDisplayForm() {
  const [displayMode, setDisplayMode] = useState<NavigationDisplayMode>("icons");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const savedMode = window.localStorage.getItem(NAVIGATION_DISPLAY_STORAGE_KEY);
    if (savedMode === "icons" || savedMode === "text") {
      setDisplayMode(savedMode);
    }
  }, []);

  function handleChange(nextMode: NavigationDisplayMode) {
    setDisplayMode(nextMode);
    window.localStorage.setItem(NAVIGATION_DISPLAY_STORAGE_KEY, nextMode);
    window.dispatchEvent(new CustomEvent("belegbox-navigation-display-changed", { detail: nextMode }));
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1500);
  }

  return (
    <Card>
      <h2 className="text-xl font-semibold tracking-tight">Menueanzeige</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Lege fest, ob die Hauptnavigation nur Symbole oder Text plus Symbol anzeigen soll.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {options.map((option) => {
          const active = displayMode === option.value;

          return (
            <button
              key={option.value}
              type="button"
              onClick={() => handleChange(option.value)}
              className={cn(
                "rounded-2xl border px-4 py-4 text-left transition",
                active
                  ? "border-primary/40 bg-primary/5 shadow-soft"
                  : "border-border bg-background hover:border-primary/25",
              )}
            >
              <span className="block text-sm font-semibold">{option.title}</span>
              <span className="mt-1 block text-sm text-muted-foreground">{option.description}</span>
            </button>
          );
        })}
      </div>

      <p className={cn("mt-4 text-sm", saved ? "text-primary" : "text-muted-foreground")}>
        {saved ? "Menueanzeige gespeichert." : "Die Aenderung wird sofort in der Navigation uebernommen."}
      </p>
    </Card>
  );
}
