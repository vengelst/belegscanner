type FieldProps = {
  label: string;
  value: string;
};

export function Field({ label, value }: FieldProps) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}
