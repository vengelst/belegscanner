import { cn } from "@/lib/utils";

const variantStyles = {
  default: "bg-muted text-muted-foreground",
  primary: "bg-primary/10 text-primary",
  success: "bg-primary/10 text-primary",
  warning: "bg-accent/20 text-accent-foreground",
  danger: "bg-danger/10 text-danger",
} as const;

type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  variant?: keyof typeof variantStyles;
};

export function Badge({ variant = "default", className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold",
        variantStyles[variant],
        className,
      )}
      {...props}
    />
  );
}
