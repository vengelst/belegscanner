"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import {
  analyzeDocumentFrame,
  type DocumentDetectionResult,
  type NormalizedDocumentBounds,
} from "@/components/receipts/document-detector";
import { CropEditor } from "@/components/receipts/crop-editor";

type CapturePayload = {
  file: File;
  detection: DocumentDetectionResult | null;
  trigger: "manual" | "auto";
};

type Props = {
  open: boolean;
  onClose: () => void;
  onCapture: (payload: CapturePayload) => void;
};

type CameraState = "camera" | "crop" | "review";

const ANALYZE_INTERVAL_MS = 280;
const AUTO_CAPTURE_HOLD_MS = 550;
const AUTO_CAPTURE_COOLDOWN_MS = 2500;
/**
 * Solange ein Frame nur knapp an den Schwellwerten scheitert, laeuft der
 * Auto-Capture-Timer weiter. Ohne diese Toleranz hat ein einzelner Wackler den
 * Countdown staendig zurueckgesetzt und der Auto-Scan loeste praktisch nie aus.
 */
const AUTO_CAPTURE_GRACE_MS = 400;
const ANALYSIS_WIDTH = 400;

export function CameraCapture({ open, onClose, onCapture }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const analysisCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const fallbackInputRef = useRef<HTMLInputElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const readySinceRef = useRef<number | null>(null);
  const lastEligibleAtRef = useRef<number>(0);
  const cooldownUntilRef = useRef<number>(0);
  const latestDetectionRef = useRef<DocumentDetectionResult | null>(null);

  const [state, setState] = useState<CameraState>("camera");
  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [capturedFile, setCapturedFile] = useState<File | null>(null);
  const [capturedPreviewUrl, setCapturedPreviewUrl] = useState<string | null>(null);
  const [captureTrigger, setCaptureTrigger] = useState<"manual" | "auto">("manual");
  const [detection, setDetection] = useState<DocumentDetectionResult | null>(null);
  /** Restzeit bis zum automatischen Ausloesen in ms, null wenn kein Countdown laeuft. */
  const [autoCaptureCountdownMs, setAutoCaptureCountdownMs] = useState<number | null>(null);

  useEffect(() => {
    if (!open) {
      stopCamera();
      resetCapture();
      resetAutoCaptureState();
      return;
    }

    setState("camera");
    setError(null);
    setDetection(null);
    resetAutoCaptureState();
    void startCamera();

    return () => {
      stopCamera();
    };
  }, [open]);

  useEffect(() => {
    if (!open || state !== "camera") return;

    const interval = window.setInterval(() => {
      analyzeCurrentFrame();
    }, ANALYZE_INTERVAL_MS);

    return () => {
      window.clearInterval(interval);
    };
  }, [open, state]);

  useEffect(() => {
    return () => {
      stopCamera();
      resetCapture();
    };
  }, []);

  const overlayStyle = useMemo(() => {
    const video = videoRef.current;
    if (!detection?.bounds || !video || video.videoWidth === 0 || video.clientWidth === 0) {
      return null;
    }
    // Der Rahmen liegt absolut ueber dem Video-Element, also wird auch gegen
    // dessen Box gerechnet - nicht gegen den aeusseren Container.
    return mapBoundsToVideoBox(
      detection.bounds,
      video.videoWidth,
      video.videoHeight,
      video.clientWidth,
      video.clientHeight,
    );
  }, [detection]);

  async function startCamera() {
    if (!isCameraAvailable()) {
      setError("Kamera ist in diesem Browser oder ohne HTTPS nicht verfuegbar.");
      return;
    }

    stopCamera();
    setIsStarting(true);
    setError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
      }
    } catch (cameraError: unknown) {
      setError(mapCameraError(cameraError));
    } finally {
      setIsStarting(false);
    }
  }

  function stopCamera() {
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop();
      }
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }

  function resetAutoCaptureState() {
    readySinceRef.current = null;
    lastEligibleAtRef.current = 0;
    latestDetectionRef.current = null;
    setAutoCaptureCountdownMs(null);
  }

  function resetCapture() {
    setCapturedFile(null);
    if (capturedPreviewUrl) {
      URL.revokeObjectURL(capturedPreviewUrl);
    }
    setCapturedPreviewUrl(null);
  }

  function analyzeCurrentFrame() {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0 || video.videoHeight === 0 || state !== "camera") {
      return;
    }

    const canvas = analysisCanvasRef.current ?? document.createElement("canvas");
    analysisCanvasRef.current = canvas;
    const ratio = video.videoHeight / video.videoWidth;
    canvas.width = ANALYSIS_WIDTH;
    canvas.height = Math.max(1, Math.round(ANALYSIS_WIDTH * ratio));
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return;

    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    const result = analyzeDocumentFrame(imageData, latestDetectionRef.current?.bounds ?? null);
    latestDetectionRef.current = result;
    setDetection(result);

    const now = Date.now();
    const eligible = result.autoCaptureEligible && !error;
    // Hysterese: ein knapp verfehlter Frame haelt den Countdown, solange die
    // Grace-Zeit seit dem letzten wirklich guten Frame nicht abgelaufen ist.
    const withinGrace =
      !eligible
      && result.nearReady
      && readySinceRef.current !== null
      && now - lastEligibleAtRef.current <= AUTO_CAPTURE_GRACE_MS;

    if (eligible) {
      lastEligibleAtRef.current = now;
      if (!readySinceRef.current) readySinceRef.current = now;
    } else if (!withinGrace) {
      readySinceRef.current = null;
    }

    if (readySinceRef.current === null) {
      setAutoCaptureCountdownMs(null);
      return;
    }

    const heldMs = now - readySinceRef.current;
    if (now >= cooldownUntilRef.current && heldMs >= AUTO_CAPTURE_HOLD_MS) {
      cooldownUntilRef.current = now + AUTO_CAPTURE_COOLDOWN_MS;
      readySinceRef.current = null;
      setAutoCaptureCountdownMs(null);
      void handleCapture("auto", result);
      return;
    }

    setAutoCaptureCountdownMs(Math.max(0, AUTO_CAPTURE_HOLD_MS - heldMs));
  }

  async function handleCapture(trigger: "manual" | "auto", detectionSnapshot?: DocumentDetectionResult | null) {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
      setError("Kamerabild ist noch nicht bereit. Bitte kurz warten.");
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");
    if (!context) {
      setError("Kamerabild konnte nicht uebernommen werden.");
      return;
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await canvasToBlob(canvas);
    const file = new File([blob], `camera-${Date.now()}.jpg`, {
      type: "image/jpeg",
      lastModified: Date.now(),
    });

    resetCapture();
    setCapturedFile(file);
    setCapturedPreviewUrl(URL.createObjectURL(blob));
    setCaptureTrigger(trigger);
    setDetection(detectionSnapshot ?? latestDetectionRef.current);
    setState("crop");
    stopCamera();
  }

  function handleRetake() {
    resetCapture();
    setDetection(null);
    setState("camera");
    resetAutoCaptureState();
    void startCamera();
  }

  function handleAccept() {
    if (!capturedFile) return;
    onCapture({
      file: capturedFile,
      detection,
      trigger: captureTrigger,
    });
    handleClose();
  }

  function handleCropConfirm(cropBounds: { x: number; y: number; width: number; height: number }) {
    if (!capturedFile) return;
    const adjustedDetection: DocumentDetectionResult | null = detection
      ? { ...detection, bounds: cropBounds }
      : { status: "ready", bounds: cropBounds, angleDeg: 0, metrics: { brightness: 0, contrast: 0, sharpness: 0, motion: 0, coverage: 0, rectangularity: 0 }, hint: "", autoCaptureEligible: false, nearReady: false };
    onCapture({
      file: capturedFile,
      detection: adjustedDetection,
      trigger: captureTrigger,
    });
    handleClose();
  }

  function handleCropSkip() {
    if (!capturedFile) return;
    const noBoundsDetection: DocumentDetectionResult | null = detection
      ? { ...detection, bounds: null }
      : null;
    onCapture({
      file: capturedFile,
      detection: noBoundsDetection,
      trigger: captureTrigger,
    });
    handleClose();
  }

  function handleClose() {
    stopCamera();
    resetCapture();
    setState("camera");
    setError(null);
    setDetection(null);
    resetAutoCaptureState();
    onClose();
  }

  function openFallbackPicker() {
    fallbackInputRef.current?.click();
  }

  async function handleFallbackFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    resetCapture();
    setCapturedFile(file);
    setCapturedPreviewUrl(URL.createObjectURL(file));
    setCaptureTrigger("manual");
    setDetection(null);
    setError(null);
    setState("crop");
    stopCamera();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm">
      <div className="flex h-full flex-col">
        <input
          ref={fallbackInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(event) => {
            void handleFallbackFileChange(event);
          }}
        />
        <div className="flex items-center justify-between border-b border-border/70 px-4 py-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">Smart Capture Phase 2</p>
            <h2 className="text-lg font-semibold tracking-tight">Beleg mit Kamera aufnehmen</h2>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="bb-chip-button rounded-2xl px-4 py-2 text-sm"
          >
            Schliessen
          </button>
        </div>

        <div className="flex flex-1 flex-col justify-between gap-4 p-4">
          {state === "camera" ? (
            <div className="flex-1 overflow-hidden rounded-[2rem] border border-border bg-black/90">
              <div className="relative h-full min-h-[18rem]">
                <video
                  ref={videoRef}
                  className="h-full w-full object-cover"
                  playsInline
                  muted
                  autoPlay
                />
                <div
                  className={`scan-beam ${detection?.autoCaptureEligible ? "scan-beam--active" : ""}`}
                  aria-hidden="true"
                />
                {overlayStyle ? (
                  <div
                    className={`pointer-events-none absolute rounded-[1.25rem] border-2 ${getOverlayClass(detection?.status ?? "not_found")}`}
                    style={overlayStyle}
                  />
                ) : (
                  <div className="pointer-events-none absolute inset-x-6 top-6 bottom-24 rounded-[1.75rem] border-2 border-white/60 shadow-[0_0_0_9999px_rgba(0,0,0,0.24)]" />
                )}
                {autoCaptureCountdownMs !== null ? (
                  <div className="pointer-events-none absolute inset-x-4 top-4 rounded-full bg-primary/90 px-4 py-2 text-center text-sm font-semibold text-primary-foreground">
                    Aufnahme in {(autoCaptureCountdownMs / 1000).toFixed(1)}s - bitte stillhalten
                  </div>
                ) : null}
                <div className="absolute inset-x-4 bottom-4 space-y-2">
                  <StatusBadge detection={detection} />
                  <p className="rounded-full bg-black/60 px-4 py-2 text-center text-xs font-medium text-white">
                    {detection?.hint ?? "Beleg ins Sichtfeld bringen oder manuell ausloesen"}
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          {state === "crop" && capturedPreviewUrl ? (
            <div className="flex flex-1 flex-col">
              <CropEditor
                imageUrl={capturedPreviewUrl}
                initialBounds={detection?.bounds ?? null}
                onConfirm={handleCropConfirm}
                onSkip={handleCropSkip}
                onRetake={handleRetake}
              />
            </div>
          ) : null}

          {state === "review" && capturedPreviewUrl ? (
            <div className="flex-1 overflow-hidden rounded-[2rem] border border-border bg-black/90">
              <img src={capturedPreviewUrl} alt="Aufgenommener Beleg" className="h-full w-full object-contain" />
            </div>
          ) : null}

          <div className={`space-y-3 ${state === "crop" ? "hidden" : ""}`}>
            {error ? <p className="text-sm font-medium text-danger">{error}</p> : null}
            {!error && state === "camera" ? (
              <p className="text-sm text-muted-foreground">
                Auto-Capture loest nur aus, wenn Dokumentgroesse, Schaerfe, Helligkeit, Kontrast und Stabilitaet ausreichen. Manuelles Ausloesen und die native Handy-Kamera bleiben immer moeglich.
              </p>
            ) : null}

            <div className="flex flex-wrap gap-3">
              {state === "camera" ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      void handleCapture("manual");
                    }}
                    disabled={isStarting || !!error}
                    className="flex-1 rounded-2xl bg-primary px-6 py-4 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isStarting ? "Kamera startet..." : detection?.autoCaptureEligible ? "Manuell jetzt aufnehmen" : "Foto aufnehmen"}
                  </button>
                  <button
                    type="button"
                    onClick={openFallbackPicker}
                    className="bb-chip-button rounded-2xl px-6 py-4 text-sm"
                  >
                    Handy-Kamera / Bild waehlen
                  </button>
                </>
              ) : null}
              {state === "review" ? (
                <>
                  <button
                    type="button"
                    onClick={handleRetake}
                    className="bb-chip-button rounded-2xl px-6 py-4 text-sm"
                  >
                    Neu aufnehmen
                  </button>
                  <button
                    type="button"
                    onClick={handleAccept}
                    className="flex-1 rounded-2xl bg-primary px-6 py-4 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
                  >
                    Bild uebernehmen
                  </button>
                </>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ detection }: { detection: DocumentDetectionResult | null }) {
  if (!detection) {
    return <div className="rounded-full bg-black/60 px-4 py-2 text-center text-xs font-semibold text-white">Dokumentsuche startet...</div>;
  }

  const config = {
    not_found: "bg-danger/85 text-white",
    uncertain: "bg-accent/85 text-accent-foreground",
    ready: "bg-primary/85 text-primary-foreground",
  } as const;

  const labels = {
    not_found: "Kein Dokument sicher erkannt",
    uncertain: "Dokument erkannt, aber noch nicht capture-bereit",
    ready: "Dokument bereit fuer Auto-Capture",
  } as const;

  return (
    <div className={`rounded-full px-4 py-2 text-center text-xs font-semibold ${config[detection.status]}`}>
      {labels[detection.status]}
    </div>
  );
}

function getOverlayClass(status: DocumentDetectionResult["status"]) {
  if (status === "ready") return "border-primary shadow-[0_0_0_9999px_rgba(0,0,0,0.18)]";
  if (status === "uncertain") return "border-accent shadow-[0_0_0_9999px_rgba(0,0,0,0.22)]";
  return "border-white/60 shadow-[0_0_0_9999px_rgba(0,0,0,0.24)]";
}

/**
 * Bildet normalisierte Detection-Bounds auf die Video-Box ab. Das Video wird mit
 * `object-cover` gerendert, der sichtbare Ausschnitt ist also beschnitten - daher
 * wird mit dem groesseren Skalierungsfaktor und negativen Offsets gerechnet.
 */
function mapBoundsToVideoBox(
  bounds: NormalizedDocumentBounds,
  videoWidth: number,
  videoHeight: number,
  boxWidth: number,
  boxHeight: number,
) {
  const scale = Math.max(boxWidth / videoWidth, boxHeight / videoHeight);
  const renderedWidth = videoWidth * scale;
  const renderedHeight = videoHeight * scale;
  const offsetX = (boxWidth - renderedWidth) / 2;
  const offsetY = (boxHeight - renderedHeight) / 2;

  return {
    left: `${offsetX + bounds.x * renderedWidth}px`,
    top: `${offsetY + bounds.y * renderedHeight}px`,
    width: `${bounds.width * renderedWidth}px`,
    height: `${bounds.height * renderedHeight}px`,
  };
}

function isCameraAvailable() {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  const secure = window.isSecureContext || ["localhost", "127.0.0.1"].includes(window.location.hostname);
  return secure && !!navigator.mediaDevices?.getUserMedia;
}

function mapCameraError(error: unknown) {
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError") {
      return "Kamerazugriff wurde verweigert. Bitte Browser-Berechtigung pruefen.";
    }
    if (error.name === "NotFoundError") {
      return "Keine Kamera verfuegbar.";
    }
    if (error.name === "NotReadableError") {
      return "Kamera ist bereits in Benutzung oder nicht lesbar.";
    }
    if (error.name === "AbortError") {
      return "Kameraaufnahme wurde abgebrochen.";
    }
  }
  return "Kamera konnte nicht gestartet werden.";
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Kamerabild konnte nicht erstellt werden."));
        return;
      }
      resolve(blob);
    }, "image/jpeg", 0.92);
  });
}
