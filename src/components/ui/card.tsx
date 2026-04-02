import { cn } from "@/lib/utils";

export function Card({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-[calc(var(--radius)+0.5rem)] border border-border/80 bg-card p-6 text-card-foreground shadow-soft",
        className
      )}
      {...props}
    />
  );
}

