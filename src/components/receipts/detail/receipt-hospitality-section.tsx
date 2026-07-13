import { Card } from "@/components/ui/card";
import { Field } from "./field";

type ReceiptHospitalitySectionProps = {
  occasion: string;
  guests: string;
  location: string;
};

export function ReceiptHospitalitySection({ occasion, guests, location }: ReceiptHospitalitySectionProps) {
  return (
    <Card>
      <h2 className="text-lg font-semibold tracking-tight">Bewirtungsangaben</h2>
      <div className="mt-4 grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Anlass" value={occasion} />
        <Field label="Gaeste" value={guests} />
        <Field label="Ort" value={location} />
      </div>
    </Card>
  );
}
