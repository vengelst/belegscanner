"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

type PasswordInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label: string;
};

export function PasswordInput({ label, className, id, ...props }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  const inputId = id ?? label.toLowerCase().replace(/\s+/g, "-");

  return (
    <label htmlFor={inputId} className="grid gap-2 text-sm font-medium">
      <span>{label}</span>
      <div className="relative">
        <input
          id={inputId}
          type={visible ? "text" : "password"}
          className={cn(
            "h-12 w-full rounded-2xl border border-border bg-background px-4 pr-12 outline-none transition",
            "focus:border-primary focus:ring-2 focus:ring-primary/10",
            className
          )}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible(!visible)}
          tabIndex={-1}
          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-muted-foreground transition hover:text-foreground"
          aria-label={visible ? "Passwort verbergen" : "Passwort anzeigen"}
        >
          {visible ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>
    </label>
  );
}

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}
