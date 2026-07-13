type StatusBadgeProps = {
  status: string;
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const colors: Record<string, string> = {
    OPEN: "bg-muted text-muted-foreground",
    READY: "bg-accent/20 text-accent-foreground",
    SENT: "bg-primary/10 text-primary",
    FAILED: "bg-danger/10 text-danger",
    RETRY: "bg-accent/20 text-accent-foreground",
  };
  return (
    <span className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${colors[status] ?? ""}`}>
      {status}
    </span>
  );
}
