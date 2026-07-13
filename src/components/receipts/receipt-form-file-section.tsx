"use client";

import { Card } from "@/components/ui/card";
import type { OcrResult } from "@/lib/document-analysis";
import type { ReceiptImageProcessingResult } from "@/lib/receipt-image-processing";
import { SmartCaptureSuggestions } from "@/components/receipts/smart-capture-suggestions";
import { getAnalysisHeadline } from "@/lib/receipts/form-helpers";
import type { FieldReviewStateMap } from "@/lib/receipts/field-review-states";
import type { CaptureSource, CaptureTrigger } from "@/lib/receipts/form-helpers";

type Props = {
  originalFile: File | null;
  previewUrl: string | null;
  captureSource: CaptureSource | null;
  captureTrigger: CaptureTrigger | null;
  workingImageInfo: ReceiptImageProcessingResult | null;
  cameraSupported: boolean;
  isPreparingAsset: boolean;
  ocrRunning: boolean;
  ocrResult: OcrResult | null;
  hasDetectedValues: boolean;
  fieldReviewStates: FieldReviewStateMap;
  suggestedPurpose: { id: string; label: string; reason: string } | null;
  suggestedCountry: { id: string; label: string; reason: string } | null;
  purposeId: string;
  countryId: string;
  onOpenCamera: () => void;
  onFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onApplySuggestedPurpose: (purposeId: string) => void;
  onApplySuggestedCountry: (countryId: string) => void;
};

export function ReceiptFormFileSection({
  originalFile,
  previewUrl,
  captureSource,
  captureTrigger,
  workingImageInfo,
  cameraSupported,
  isPreparingAsset,
  ocrRunning,
  ocrResult,
  hasDetectedValues,
  fieldReviewStates,
  suggestedPurpose,
  suggestedCountry,
  purposeId,
  countryId,
  onOpenCamera,
  onFileChange,
  onApplySuggestedPurpose,
  onApplySuggestedCountry,
}: Props) {
  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Belegdatei</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            JPG, PNG oder PDF hochladen (max. 20 MB). Die Originaldatei ist fuer neue Belege Pflicht. ChatGPT liest den Beleg automatisch aus; fehlende Angaben kannst du manuell ergaenzen.
          </p>
        </div>
        {captureSource ? (
          <span className="rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
            Quelle: {captureSource === "camera" ? `Kamera${captureTrigger === "auto" ? " (Auto-Capture)" : captureTrigger === "manual" ? " (manuell)" : ""}` : "Datei-Upload"}
          </span>
        ) : null}
      </div>
      <div className="mt-4 space-y-4">
        <div className="flex flex-wrap gap-3">
          {cameraSupported ? (
            <button
              type="button"
              onClick={onOpenCamera}
              className="rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
            >
              Kamera in App oeffnen
            </button>
          ) : (
            <p className="text-sm text-muted-foreground">
              In-App-Kamera braucht HTTPS oder localhost. Der normale Upload funktioniert weiterhin.
            </p>
          )}
          <label className="inline-flex cursor-pointer items-center rounded-2xl border border-border bg-card px-5 py-3 text-sm font-semibold transition hover:border-primary/40 hover:text-primary">
            Datei auswaehlen
            <input
              type="file"
              accept="image/jpeg,image/png,application/pdf"
              onChange={onFileChange}
              className="sr-only"
            />
          </label>
        </div>

        <label className={`flex cursor-pointer flex-col items-center gap-3 rounded-2xl border-2 border-dashed p-8 transition hover:border-primary/40 hover:bg-primary/5 ${originalFile ? "border-border" : "border-accent/40"}`}>
          <span className="text-sm font-medium text-muted-foreground">
            {originalFile ? originalFile.name : "Kamera oder Datei waehlen"}
          </span>
          <span className="text-xs text-muted-foreground">
            Originalbild bleibt unveraendert gespeichert. Bei Fotos nutzt die KI-Auslese eine getrennte Arbeitskopie fuer Vorschau, Crop und Lesbarkeit.
          </span>
        </label>

        {previewUrl ? (
          <img src={previewUrl} alt="Vorschau" className="max-h-72 w-full rounded-xl object-contain" />
        ) : null}
        {isPreparingAsset ? (
          <p className="text-sm text-muted-foreground">Bild wird fuer Vorschau und KI-Auslese vorbereitet...</p>
        ) : null}
        {workingImageInfo ? (
          <div className="rounded-xl border border-border/80 bg-muted/40 p-3 text-xs text-muted-foreground">
            Arbeitskopie fuer KI-Auslese: {workingImageInfo.appliedSteps.join(", ")}
          </div>
        ) : null}
        {ocrRunning ? (
          <p className="text-sm text-muted-foreground">ChatGPT analysiert den Beleg...</p>
        ) : null}
        {ocrResult ? (
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
            <p className="text-xs font-semibold text-primary">
              {getAnalysisHeadline(ocrResult.sourceType)}
            </p>
            {ocrResult.message ? (
              <p className="mt-1 text-xs text-muted-foreground">{ocrResult.message}</p>
            ) : null}
            {hasDetectedValues ? (
              <div className="mt-3">
                <SmartCaptureSuggestions
                  ocrResult={ocrResult}
                  purposeSuggestion={suggestedPurpose}
                  countrySuggestion={suggestedCountry}
                  currentPurposeId={purposeId}
                  currentCountryId={countryId}
                  fieldReviewStates={fieldReviewStates}
                  onApplySuggestedPurpose={onApplySuggestedPurpose}
                  onApplySuggestedCountry={onApplySuggestedCountry}
                />
              </div>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">Es wurden keine verlaesslichen Werte erkannt. Du kannst den Beleg komplett manuell erfassen.</p>
            )}
          </div>
        ) : null}
      </div>
    </Card>
  );
}
