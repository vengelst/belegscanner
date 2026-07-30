"use client";

import { useState } from "react";
import { Palette, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { UiTemplate } from "@/lib/validation";

type TemplateSelectorProps = {
  currentTemplate: UiTemplate;
};

const templates: Array<{
  id: UiTemplate;
  name: string;
  description: string;
  icon: typeof Palette;
}> = [
  {
    id: "classic",
    name: "Klassisch",
    description: "Das bewaehrte BelegBox-Design mit klaren Linien und vertrauter Struktur.",
    icon: Palette,
  },
  {
    id: "modern",
    name: "Modern",
    description: "Neues Design mit weichen Schatten und elegantem Soft-UI-Stil.",
    icon: Sparkles,
  },
];

export function TemplateSelector({ currentTemplate }: TemplateSelectorProps) {
  const [selected, setSelected] = useState<UiTemplate>(currentTemplate);
  const [isUpdating, setIsUpdating] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleSelect = async (templateId: UiTemplate) => {
    if (templateId === selected || isUpdating) return;

    setIsUpdating(true);
    setMessage(null);

    try {
      const response = await fetch("/api/users/me/template", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uiTemplate: templateId }),
      });

      if (!response.ok) {
        throw new Error("Fehler beim Speichern");
      }

      setSelected(templateId);
      setMessage({ type: "success", text: "Template wurde geaendert. Die Seite wird neu geladen..." });
      
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch {
      setMessage({ type: "error", text: "Fehler beim Speichern des Templates." });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {templates.map((template) => {
          const Icon = template.icon;
          const isSelected = selected === template.id;

          return (
            <button
              key={template.id}
              type="button"
              onClick={() => handleSelect(template.id)}
              disabled={isUpdating}
              className={cn(
                "relative flex flex-col items-start gap-3 rounded-2xl border-2 p-5 text-left transition-all",
                "hover:border-primary/40 hover:bg-muted/30",
                "disabled:cursor-not-allowed disabled:opacity-60",
                isSelected
                  ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                  : "border-border bg-card"
              )}
            >
              <div
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-xl",
                  isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                )}
              >
                <Icon className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <h3 className="font-semibold">{template.name}</h3>
                <p className="text-sm text-muted-foreground">{template.description}</p>
              </div>
              {isSelected && (
                <div className="absolute right-3 top-3 h-3 w-3 rounded-full bg-primary" />
              )}
            </button>
          );
        })}
      </div>

      {message && (
        <p
          className={cn(
            "text-sm font-medium",
            message.type === "success" ? "text-green-600 dark:text-green-400" : "text-danger"
          )}
        >
          {message.text}
        </p>
      )}
    </div>
  );
}
