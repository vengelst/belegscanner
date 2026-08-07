"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { normalizeCardLastDigits } from "@/lib/datev/belegtyp";

/**
 * Pflege der Firmenkarten-Endziffern.
 *
 * Aus Sicherheitsgruenden werden ausschliesslich die letzten 2 bis 4 Ziffern
 * gespeichert, niemals vollstaendige Kartennummern.
 */
export function CompanyCardsForm({ initial }: { initial: string[] }) {
  const [cards, setCards] = useState<string[]>(initial);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function addCard() {
    setSuccess(null);
    const digits = normalizeCardLastDigits(input);
    if (digits.length < 2 || digits.length > 4) {
      setError("Bitte 2 bis 4 Ziffern eingeben (z. B. 2454).");
      return;
    }
    if (cards.includes(digits)) {
      setError("Diese Endziffern sind bereits hinterlegt.");
      return;
    }
    setError(null);
    setCards([...cards, digits]);
    setInput("");
  }

  function removeCard(digits: string) {
    setSuccess(null);
    setError(null);
    setCards(cards.filter((card) => card !== digits));
  }

  function handleSave() {
    setError(null);
    setSuccess(null);

    startTransition(async () => {
      const res = await fetch("/api/admin/organization", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyCardLastDigits: cards }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Fehler beim Speichern.");
        return;
      }
      setSuccess("Firmenkarten wurden gespeichert.");
      router.refresh();
    });
  }

  return (
    <Card>
      <h2 className="text-lg font-semibold tracking-tight">Firmenkarten</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Endziffern der Firmenkarten (2 bis 4 Ziffern). Erkennt die Belegerkennung eine dieser
        Kartenendungen, wird der Beleg als <strong>Kreditkartenbeleg</strong> eingestuft. Jede andere
        Karte gilt als privat verauslagt und landet in der <strong>Kasse</strong>.
        Es werden nur Endziffern gespeichert, nie vollstaendige Kartennummern.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {cards.length === 0 ? (
          <p className="text-sm text-muted-foreground">Keine Firmenkarten hinterlegt.</p>
        ) : (
          cards.map((card) => (
            <span
              key={card}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-muted px-3 py-1.5 text-sm font-medium tabular-nums"
            >
              **** {card}
              <button
                type="button"
                onClick={() => removeCard(card)}
                aria-label={`Karte ${card} entfernen`}
                className="text-muted-foreground transition hover:text-danger"
              >
                &times;
              </button>
            </span>
          ))
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="grid gap-1 text-sm font-medium">
          <span className="text-xs text-muted-foreground">Endziffern hinzufuegen</span>
          <input
            value={input}
            inputMode="numeric"
            maxLength={4}
            placeholder="2454"
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addCard();
              }
            }}
            className="bb-input input-3d h-10 w-32 rounded-xl px-3 text-sm tabular-nums outline-none transition-all duration-200 focus:ring-2 focus:ring-primary/20"
          />
        </label>
        <button
          type="button"
          onClick={addCard}
          className="bb-chip-button h-10 rounded-2xl px-4 text-sm font-medium"
        >
          Hinzufuegen
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          className="h-10 rounded-2xl bg-primary px-6 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
        >
          {isPending ? "Wird gespeichert..." : "Speichern"}
        </button>
      </div>

      {error ? <p className="mt-3 text-sm font-medium text-danger">{error}</p> : null}
      {success ? <p className="mt-3 text-sm font-medium text-primary">{success}</p> : null}
    </Card>
  );
}
