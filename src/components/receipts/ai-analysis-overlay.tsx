"use client";

type Props = {
  /** true nur während der KI-Auslese */
  active: boolean;
  /** Optionaler Hinweistext unter dem Ring */
  message?: string;
};

/**
 * Vollflächiger animierter Erkennungs-Ring (Option C),
 * solange die KI den Beleg analysiert.
 */
export function AiAnalysisOverlay({
  active,
  message = "KI erkennt den Beleg…",
}: Props) {
  if (!active) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-background/85 backdrop-blur-sm"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="flex flex-col items-center gap-8 px-6 text-center">
        <div className="ai-ring" aria-hidden="true">
          <div className="ai-ring__track" />
          <div className="ai-ring__spinner" />
          <div className="ai-ring__core">
            <span className="ai-ring__grain" />
            <span className="ai-ring__grain" />
            <span className="ai-ring__grain" />
            <span className="ai-ring__grain" />
            <span className="ai-ring__grain" />
            <span className="ai-ring__grain" />
            <span className="ai-ring__grain" />
            <span className="ai-ring__grain" />
            <span className="ai-ring__grain" />
            <span className="ai-ring__grain" />
            <span className="ai-ring__grain" />
            <span className="ai-ring__grain" />
            <div className="ai-ring__pile" />
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-2xl font-semibold tracking-tight text-primary sm:text-3xl">
            {message}
          </p>
          <p className="text-sm text-muted-foreground sm:text-base">
            Bitte kurz warten — Felder werden automatisch vorbelegt.
          </p>
        </div>
      </div>
    </div>
  );
}
