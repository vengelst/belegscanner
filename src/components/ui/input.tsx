import { cn } from "@/lib/utils";

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
};

export function Input({ label, className, id, ...props }: InputProps) {
  const inputId = id ?? label.toLowerCase().replace(/\s+/g, "-");

  return (
    <label htmlFor={inputId} className="grid gap-2 text-sm font-medium">
      <span>{label}</span>
      <input
        id={inputId}
        className={cn(
          "h-12 rounded-2xl border border-border bg-background px-4 outline-none transition",
          "focus:border-primary focus:ring-2 focus:ring-primary/10",
          className
        )}
        {...props}
      />
    </label>
  );
}

