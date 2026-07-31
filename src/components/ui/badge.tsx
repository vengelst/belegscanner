import { cn } from "@/lib/utils";

const variantStyles = {
  default: "bb-badge-default bg-muted text-muted-foreground",
  primary: "bb-badge-primary bg-primary/10 text-primary",
  success: "bb-badge-success bg-primary/10 text-primary",
  warning: "bb-badge-warning bg-accent/20 text-accent-foreground",
  danger: "bb-badge-danger bg-danger/10 text-danger",
} as const;

type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  variant?: keyof typeof variantStyles;
};

export function Badge({ variant = "default", className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "bb-badge inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold transition-shadow duration-200",
        variantStyles[variant],
        className,
      )}
      {...props}
    />
  );
}
