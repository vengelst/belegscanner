"use client";

import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { OcrResult } from "@/lib/document-analysis";

type Props = {
  ocrResult: OcrResult | null;
  occasion: string;
  guests: string;
  hospitalityLocation: string;
  setOccasion: (v: string) => void;
  setGuests: (v: string) => void;
  setHospitalityLocationManual: (v: boolean) => void;
  setHospitalityLocation: (v: string) => void;
};

export function ReceiptFormHospitalitySection({
  ocrResult,
  occasion,
  guests,
  hospitalityLocation,
  setOccasion,
  setGuests,
  setHospitalityLocationManual,
  setHospitalityLocation,
}: Props) {
  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Bewirtungsangaben</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Diese Felder sind bei Bewirtungsbelegen Pflicht.
          </p>
        </div>
        {ocrResult?.extracted.documentType === "hospitality" ? (
          <span className="rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
            KI vermutet Bewirtungsbeleg
          </span>
        ) : null}
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Input label="Anlass" name="occasion" required placeholder="z.B. Projektbesprechung" value={occasion} onChange={(event: React.ChangeEvent<HTMLInputElement>) => setOccasion(event.target.value)} />
        <label className="grid gap-1 text-sm font-medium">
          <span className="text-xs text-muted-foreground">Gaeste / Teilnehmer</span>
          <textarea
            name="guests"
            required
            rows={2}
            placeholder="Hr. Mueller, Fr. Schmidt"
            value={guests}
            onChange={(event) => setGuests(event.target.value)}
            className="rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
          />
        </label>
        <Input label="Ort" name="location" required placeholder="z.B. Restaurant Adria, Berlin" value={hospitalityLocation} onChange={(event: React.ChangeEvent<HTMLInputElement>) => { setHospitalityLocationManual(true); setHospitalityLocation(event.target.value); }} />
      </div>
    </Card>
  );
}
