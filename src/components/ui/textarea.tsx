import { cn } from "@/lib/utils";

type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
};

export function Textarea({ label, className, id, ...props }: TextareaProps) {
  const textareaId = id ?? label.toLowerCase().replace(/\s+/g, "-");

  return (
    <label htmlFor={textareaId} className="bb-input-wrapper grid gap-1 text-sm font-medium">
      <span className="text-xs text-muted-foreground">{label}</span>
      <textarea
        id={textareaId}
        className={cn(
          "bb-input bb-textarea input-3d min-h-[4.5rem] rounded-xl px-3 py-2.5 text-sm outline-none transition-all duration-200",
          "focus:ring-2 focus:ring-primary/20",
          className,
        )}
        {...props}
      />
    </label>
  );
}
