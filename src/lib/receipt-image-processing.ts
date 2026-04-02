"use client";

const MAX_WORKING_DIMENSION = 1800;
const WORKING_IMAGE_QUALITY = 0.88;
const IMAGE_FILTER = "contrast(1.12) brightness(1.03) saturate(1.04)";

export type NormalizedCropBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type WorkingImageOptions = {
  cropBounds?: NormalizedCropBounds | null;
  rotationDeg?: number;
};

export type ReceiptImageProcessingResult = {
  workingFile: File;
  previewUrl: string;
  appliedSteps: string[];
  usesDerivedImage: boolean;
};

export async function createReceiptWorkingImage(
  originalFile: File,
  options: WorkingImageOptions = {},
): Promise<ReceiptImageProcessingResult> {
  const image = await loadImage(originalFile);
  const sourceCanvas = document.createElement("canvas");
  sourceCanvas.width = image.naturalWidth;
  sourceCanvas.height = image.naturalHeight;

  const sourceContext = sourceCanvas.getContext("2d");
  if (!sourceContext) {
    throw new Error("Bildvorschau konnte nicht vorbereitet werden.");
  }

  sourceContext.drawImage(image, 0, 0);

  let workingCanvas = sourceCanvas;
  const appliedSteps: string[] = [];

  if (options.cropBounds && isValidCrop(options.cropBounds)) {
    workingCanvas = cropCanvas(workingCanvas, options.cropBounds);
    appliedSteps.push("Dokument zugeschnitten");
  }

  if (options.rotationDeg && Math.abs(options.rotationDeg) >= 1.5 && Math.abs(options.rotationDeg) <= 15) {
    workingCanvas = rotateCanvas(workingCanvas, -options.rotationDeg);
    appliedSteps.push("Ausrichtung korrigiert");
  }

  const { width, height, scaled } = getTargetDimensions(workingCanvas.width, workingCanvas.height);
  const finalCanvas = document.createElement("canvas");
  finalCanvas.width = width;
  finalCanvas.height = height;

  const finalContext = finalCanvas.getContext("2d");
  if (!finalContext) {
    throw new Error("Bildvorschau konnte nicht vorbereitet werden.");
  }

  finalContext.imageSmoothingEnabled = true;
  finalContext.imageSmoothingQuality = "high";
  finalContext.filter = IMAGE_FILTER;
  finalContext.drawImage(workingCanvas, 0, 0, width, height);
  finalContext.filter = "none";

  const blob = await canvasToBlob(finalCanvas, "image/jpeg", WORKING_IMAGE_QUALITY);
  const workingFile = new File([blob], buildWorkingFilename(originalFile.name), {
    type: "image/jpeg",
    lastModified: Date.now(),
  });

  if (scaled) appliedSteps.push("Auf OCR-Groesse skaliert");
  appliedSteps.push("Kontrast verbessert", "OCR-Arbeitskopie erstellt");

  return {
    workingFile,
    previewUrl: URL.createObjectURL(blob),
    appliedSteps,
    usesDerivedImage: true,
  };
}

function cropCanvas(canvas: HTMLCanvasElement, bounds: NormalizedCropBounds) {
  const margin = 0.03;
  const sx = Math.max(0, Math.floor((bounds.x - margin) * canvas.width));
  const sy = Math.max(0, Math.floor((bounds.y - margin) * canvas.height));
  const sw = Math.min(canvas.width - sx, Math.ceil((bounds.width + margin * 2) * canvas.width));
  const sh = Math.min(canvas.height - sy, Math.ceil((bounds.height + margin * 2) * canvas.height));

  const croppedCanvas = document.createElement("canvas");
  croppedCanvas.width = sw;
  croppedCanvas.height = sh;
  const context = croppedCanvas.getContext("2d");
  if (!context) {
    throw new Error("Bild konnte nicht zugeschnitten werden.");
  }
  context.drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh);
  return croppedCanvas;
}

function rotateCanvas(canvas: HTMLCanvasElement, rotationDeg: number) {
  const radians = (rotationDeg * Math.PI) / 180;
  const sin = Math.abs(Math.sin(radians));
  const cos = Math.abs(Math.cos(radians));
  const targetWidth = Math.max(1, Math.round(canvas.width * cos + canvas.height * sin));
  const targetHeight = Math.max(1, Math.round(canvas.width * sin + canvas.height * cos));

  const rotatedCanvas = document.createElement("canvas");
  rotatedCanvas.width = targetWidth;
  rotatedCanvas.height = targetHeight;
  const context = rotatedCanvas.getContext("2d");
  if (!context) {
    throw new Error("Bild konnte nicht gedreht werden.");
  }

  context.translate(targetWidth / 2, targetHeight / 2);
  context.rotate(radians);
  context.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);
  return rotatedCanvas;
}

function getTargetDimensions(width: number, height: number) {
  const maxDimension = Math.max(width, height);
  if (maxDimension <= MAX_WORKING_DIMENSION) {
    return { width, height, scaled: false };
  }

  const scale = MAX_WORKING_DIMENSION / maxDimension;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
    scaled: true,
  };
}

function isValidCrop(bounds: NormalizedCropBounds) {
  return bounds.width > 0.1 && bounds.height > 0.1;
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Bild konnte nicht geladen werden."));
    };
    image.src = objectUrl;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Bild konnte nicht verarbeitet werden."));
        return;
      }
      resolve(blob);
    }, type, quality);
  });
}

function buildWorkingFilename(originalName: string) {
  const baseName = originalName.replace(/\.[^.]+$/, "") || "beleg";
  return `${baseName}-ocr.jpg`;
}
