"use client";

type Props = {
  /** true während Bildvorbereitung oder KI-Auslese */
  active: boolean;
  /** Optionaler Hinweistext unter der Sanduhr */
  message?: string;
};

/**
 * Vollflächige Sanduhr, solange die KI den Beleg erkennt.
 * Blockiert Interaktion und ist bewusst gross und zentral.
 */
export function AiAnalysisOverlay({
  active,
  message = "KI erkennt den Beleg…",
}: Props) {
  if (!active) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="flex flex-col items-center gap-6 px-6 text-center">
        <div className="hourglass" aria-hidden="true">
          <div className="hourglass__frame">
            <div className="hourglass__sand hourglass__sand--top" />
            <div className="hourglass__sand hourglass__sand--bottom" />
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
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
