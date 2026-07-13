export default function ReceiptsLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="h-4 w-24 animate-pulse rounded bg-muted" />
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
      </div>

      <div className="h-10 w-full animate-pulse rounded-xl bg-muted" />

      <div className="space-y-3">
        {Array.from({ length: 4 }, (_, i) => (
          <div
            key={i}
            className="rounded-[calc(var(--radius)+0.5rem)] border border-border/80 bg-card p-5 shadow-soft"
          >
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <div className="h-4 w-36 animate-pulse rounded bg-muted" />
                <div className="h-3 w-24 animate-pulse rounded bg-muted" />
              </div>
              <div className="flex items-center gap-3">
                <div className="h-4 w-20 animate-pulse rounded bg-muted" />
                <div className="h-6 w-16 animate-pulse rounded-full bg-muted" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
