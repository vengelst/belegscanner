"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";

type Comment = {
  id: string;
  text: string;
  createdAt: string;
  user: { name: string };
};

export function ReceiptComments({ receiptId }: { receiptId: string }) {
  const router = useRouter();
  const [comments, setComments] = useState<Comment[]>([]);
  const [text, setText] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/receipts/${receiptId}/comments`)
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setComments(data); })
      .catch(() => {});
  }, [receiptId]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setError(null);

    startTransition(async () => {
      const res = await fetch(`/api/receipts/${receiptId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.trim() }),
      });
      if (res.ok) {
        const comment = await res.json();
        setComments((prev) => [comment, ...prev]);
        setText("");
      } else {
        const data = await res.json();
        setError(data.error ?? "Kommentar konnte nicht gespeichert werden.");
      }
      router.refresh();
    });
  }

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="space-y-4">
      {/* New comment form */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Interner Kommentar oder Pruefnotiz..."
          className="h-10 flex-1 rounded-2xl border border-border bg-background px-4 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
        />
        <button
          type="submit"
          disabled={isPending || !text.trim()}
          className="h-10 rounded-2xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
        >
          {isPending ? "..." : "Senden"}
        </button>
      </form>
      {error ? <p className="text-xs font-medium text-danger">{error}</p> : null}

      {/* Comment list */}
      {comments.length === 0 ? (
        <p className="text-xs text-muted-foreground">Noch keine Kommentare.</p>
      ) : (
        <div className="space-y-2">
          {comments.map((c) => (
            <div key={c.id} className="rounded-xl border border-border/50 bg-muted/30 p-3">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-xs font-semibold">{c.user.name}</span>
                <span className="text-[10px] text-muted-foreground">{fmtDate(c.createdAt)}</span>
              </div>
              <p className="mt-1 text-sm">{c.text}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
