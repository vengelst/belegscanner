export type KpiCardProps = {
  label: string;
  value: string;
  danger?: boolean;
};

export function KpiCard({ label, value, danger }: KpiCardProps) {
  return (
    <div className="bb-card rounded-[calc(var(--radius)+0.5rem)] border border-border/80 bg-card p-5 shadow-soft transition-shadow duration-200">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`mt-2 text-2xl font-semibold tabular-nums ${danger ? "text-danger" : "text-foreground"}`}>{value}</p>
    </div>
  );
}
