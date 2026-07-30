"use client";

import { createContext, useState, useCallback, type ReactNode } from "react";
import type { UiTemplate } from "@/lib/validation";

type TemplateContextType = {
  template: UiTemplate;
  setTemplate: (template: UiTemplate) => Promise<void>;
  isUpdating: boolean;
};

export const TemplateContext = createContext<TemplateContextType | null>(null);

type TemplateProviderProps = {
  initialTemplate: UiTemplate;
  children: ReactNode;
};

export function TemplateProvider({ initialTemplate, children }: TemplateProviderProps) {
  const [template, setTemplateState] = useState<UiTemplate>(initialTemplate);
  const [isUpdating, setIsUpdating] = useState(false);

  const setTemplate = useCallback(async (newTemplate: UiTemplate) => {
    setIsUpdating(true);
    try {
      const response = await fetch("/api/users/me/template", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uiTemplate: newTemplate }),
      });

      if (!response.ok) {
        throw new Error("Fehler beim Speichern des Templates");
      }

      setTemplateState(newTemplate);
    } finally {
      setIsUpdating(false);
    }
  }, []);

  return (
    <TemplateContext.Provider value={{ template, setTemplate, isUpdating }}>
      {children}
    </TemplateContext.Provider>
  );
}
