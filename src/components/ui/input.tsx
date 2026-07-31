import { cn } from "@/lib/utils";

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
};

export function Input({ label, className, id, ...props }: InputProps) {
  const inputId = id ?? label.toLowerCase().replace(/\s+/g, "-");

  return (
    <label htmlFor={inputId} className="bb-input-wrapper grid gap-1 text-sm font-medium">
      <span className="text-xs text-muted-foreground">{label}</span>
      <input
        id={inputId}
        className={cn(
          "bb-input input-3d h-10 rounded-xl px-3 text-sm outline-none transition-all duration-200",
          "focus:ring-2 focus:ring-primary/20",
          className
        )}
        {...props}
      />
    </label>
  );
}

