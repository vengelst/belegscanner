export function SelectField({
  label, name, required, value, onChange, children,
}: {
  label: string;
  name: string;
  required?: boolean;
  value?: string;
  onChange?: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="bb-select-wrapper grid gap-1 text-sm font-medium">
      <span className="text-xs text-muted-foreground">{label}</span>
      <select
        name={name}
        required={required}
        value={value}
        onChange={onChange ? (event) => onChange(event.target.value) : undefined}
        className="bb-select input-3d h-10 rounded-xl px-3 text-sm outline-none transition-all duration-200 focus:ring-2 focus:ring-primary/20"
      >
        {children}
      </select>
    </label>
  );
}
