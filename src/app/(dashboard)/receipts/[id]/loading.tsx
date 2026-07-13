export default function ReceiptDetailLoading() {
  return (
    <div className="space-y-6">
      <div className="h-4 w-32 animate-pulse rounded bg-muted" />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="h-4 w-16 animate-pulse rounded bg-muted" />
          <div className="h-8 w-64 animate-pulse rounded bg-muted" />
          <div className="h-3 w-40 animate-pulse rounded bg-muted" />
        </div>
        <div className="flex gap-2">
          <div className="h-9 w-20 animate-pulse rounded-2xl bg-muted" />
          <div className="h-9 w-24 animate-pulse rounded-2xl bg-muted" />
        </div>
      </div>

      {Array.from({ length: 3 }, (_, i) => (
        <div
          key={i}
          className="rounded-[calc(var(--radius)+0.5rem)] border border-border/80 bg-card p-6 shadow-soft"
        >
          <div className="h-5 w-40 animate-pulse rounded bg-muted" />
          <div className="mt-4 grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }, (_, j) => (
              <div key={j} className="space-y-1">
                <div className="h-3 w-20 animate-pulse rounded bg-muted" />
                <div className="h-4 w-32 animate-pulse rounded bg-muted" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
