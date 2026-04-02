"use client";

export type NormalizedDocumentBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type DocumentDetectionStatus = "not_found" | "uncertain" | "ready";

export type DocumentDetectionResult = {
  status: DocumentDetectionStatus;
  bounds: NormalizedDocumentBounds | null;
  angleDeg: number;
  metrics: {
    brightness: number;
    contrast: number;
    blur: number;
    motion: number;
    coverage: number;
    rectangularity: number;
  };
  hint: string;
  autoCaptureEligible: boolean;
};

const MIN_EDGE_PIXELS = 180;
const EDGE_THRESHOLD_MULTIPLIER = 1.85;
const MIN_COVERAGE = 0.18;
const MAX_COVERAGE = 0.9;
const MIN_RECTANGULARITY = 0.28;
const MIN_CONTRAST = 22;
const MIN_BRIGHTNESS = 55;
const MAX_BRIGHTNESS = 225;
const MIN_BLUR = 18;
const MAX_MOTION = 0.07;

export function analyzeDocumentFrame(
  imageData: ImageData,
  previousBounds: NormalizedDocumentBounds | null,
): DocumentDetectionResult {
  const { width, height, data } = imageData;
  const pixelCount = width * height;
  const grayscale = new Float32Array(pixelCount);

  let brightnessSum = 0;
  for (let index = 0; index < pixelCount; index += 1) {
    const offset = index * 4;
    const value = data[offset] * 0.299 + data[offset + 1] * 0.587 + data[offset + 2] * 0.114;
    grayscale[index] = value;
    brightnessSum += value;
  }

  const meanBrightness = brightnessSum / pixelCount;
  let varianceSum = 0;
  for (let index = 0; index < pixelCount; index += 1) {
    const delta = grayscale[index] - meanBrightness;
    varianceSum += delta * delta;
  }
  const contrast = Math.sqrt(varianceSum / pixelCount);

  const edgeValues = new Float32Array(pixelCount);
  const edgePoints: Array<{ x: number; y: number; magnitude: number }> = [];
  let edgeSum = 0;
  let edgeCount = 0;

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const index = y * width + x;
      const gx =
        -grayscale[index - width - 1] + grayscale[index - width + 1]
        - 2 * grayscale[index - 1] + 2 * grayscale[index + 1]
        - grayscale[index + width - 1] + grayscale[index + width + 1];
      const gy =
        grayscale[index - width - 1] + 2 * grayscale[index - width] + grayscale[index - width + 1]
        - grayscale[index + width - 1] - 2 * grayscale[index + width] - grayscale[index + width + 1];
      const magnitude = Math.sqrt(gx * gx + gy * gy);
      edgeValues[index] = magnitude;
      edgeSum += magnitude;
      edgeCount += 1;
    }
  }

  const meanEdge = edgeCount > 0 ? edgeSum / edgeCount : 0;
  const edgeThreshold = Math.max(24, meanEdge * EDGE_THRESHOLD_MULTIPLIER);

  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  let strongEdgeSum = 0;

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const index = y * width + x;
      const magnitude = edgeValues[index];
      if (magnitude < edgeThreshold) continue;
      edgePoints.push({ x, y, magnitude });
      strongEdgeSum += magnitude;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }

  if (edgePoints.length < MIN_EDGE_PIXELS) {
    return emptyDetection(meanBrightness, contrast, previousBounds, "Beleg ins Sichtfeld bringen");
  }

  const boxWidth = Math.max(1, maxX - minX + 1);
  const boxHeight = Math.max(1, maxY - minY + 1);
  const coverage = (boxWidth * boxHeight) / pixelCount;

  let borderEdges = 0;
  let insideEdges = 0;
  const borderThickness = Math.max(2, Math.round(Math.min(boxWidth, boxHeight) * 0.08));
  for (const point of edgePoints) {
    const onBorder =
      point.x - minX <= borderThickness
      || maxX - point.x <= borderThickness
      || point.y - minY <= borderThickness
      || maxY - point.y <= borderThickness;
    if (onBorder) borderEdges += 1;
    else insideEdges += 1;
  }

  const rectangularity = borderEdges / Math.max(1, borderEdges + insideEdges);
  const blur = strongEdgeSum / edgePoints.length;

  const normalizedBounds: NormalizedDocumentBounds = {
    x: minX / width,
    y: minY / height,
    width: boxWidth / width,
    height: boxHeight / height,
  };
  const motion = computeMotion(previousBounds, normalizedBounds);
  const angleDeg = computePrimaryAngle(edgePoints);

  const checks = [
    coverage >= MIN_COVERAGE && coverage <= MAX_COVERAGE,
    rectangularity >= MIN_RECTANGULARITY,
    contrast >= MIN_CONTRAST,
    meanBrightness >= MIN_BRIGHTNESS && meanBrightness <= MAX_BRIGHTNESS,
    blur >= MIN_BLUR,
    motion <= MAX_MOTION,
  ];

  if (checks.every(Boolean)) {
    return {
      status: "ready",
      bounds: normalizedBounds,
      angleDeg,
      metrics: {
        brightness: meanBrightness,
        contrast,
        blur,
        motion,
        coverage,
        rectangularity,
      },
      hint: "Beleg erkannt - stillhalten fuer Auto-Capture",
      autoCaptureEligible: true,
    };
  }

  return {
    status: "uncertain",
    bounds: normalizedBounds,
    angleDeg,
    metrics: {
      brightness: meanBrightness,
      contrast,
      blur,
      motion,
      coverage,
      rectangularity,
    },
    hint: buildHint({ coverage, rectangularity, meanBrightness, contrast, blur, motion }),
    autoCaptureEligible: false,
  };
}

function buildHint({
  coverage,
  rectangularity,
  meanBrightness,
  contrast,
  blur,
  motion,
}: {
  coverage: number;
  rectangularity: number;
  meanBrightness: number;
  contrast: number;
  blur: number;
  motion: number;
}) {
  if (coverage < MIN_COVERAGE) return "Naeher an den Beleg herangehen";
  if (coverage > MAX_COVERAGE) return "Etwas weiter weg gehen";
  if (rectangularity < MIN_RECTANGULARITY) return "Beleg vollstaendig im Rahmen platzieren";
  if (motion > MAX_MOTION) return "Kamera ruhiger halten";
  if (blur < MIN_BLUR) return "Bild ist zu unscharf";
  if (meanBrightness < MIN_BRIGHTNESS) return "Mehr Licht oder helleren Hintergrund nutzen";
  if (meanBrightness > MAX_BRIGHTNESS) return "Blendung reduzieren";
  if (contrast < MIN_CONTRAST) return "Kontrast ist noch zu schwach";
  return "Beleg fuer Auto-Capture noch besser ausrichten";
}

function emptyDetection(brightness: number, contrast: number, previousBounds: NormalizedDocumentBounds | null, hint: string): DocumentDetectionResult {
  return {
    status: "not_found",
    bounds: null,
    angleDeg: 0,
    metrics: {
      brightness,
      contrast,
      blur: 0,
      motion: previousBounds ? 1 : 0,
      coverage: 0,
      rectangularity: 0,
    },
    hint,
    autoCaptureEligible: false,
  };
}

function computeMotion(previousBounds: NormalizedDocumentBounds | null, currentBounds: NormalizedDocumentBounds) {
  if (!previousBounds) return 0;
  const prevCenterX = previousBounds.x + previousBounds.width / 2;
  const prevCenterY = previousBounds.y + previousBounds.height / 2;
  const currentCenterX = currentBounds.x + currentBounds.width / 2;
  const currentCenterY = currentBounds.y + currentBounds.height / 2;
  const centerDelta = Math.hypot(currentCenterX - prevCenterX, currentCenterY - prevCenterY);
  const sizeDelta = Math.abs(currentBounds.width - previousBounds.width) + Math.abs(currentBounds.height - previousBounds.height);
  return centerDelta + sizeDelta * 0.5;
}

function computePrimaryAngle(edgePoints: Array<{ x: number; y: number }>) {
  if (edgePoints.length < 2) return 0;

  let meanX = 0;
  let meanY = 0;
  for (const point of edgePoints) {
    meanX += point.x;
    meanY += point.y;
  }
  meanX /= edgePoints.length;
  meanY /= edgePoints.length;

  let covXX = 0;
  let covYY = 0;
  let covXY = 0;
  for (const point of edgePoints) {
    const dx = point.x - meanX;
    const dy = point.y - meanY;
    covXX += dx * dx;
    covYY += dy * dy;
    covXY += dx * dy;
  }

  const angleRad = 0.5 * Math.atan2(2 * covXY, covXX - covYY);
  let angleDeg = (angleRad * 180) / Math.PI;
  if (angleDeg > 45) angleDeg -= 90;
  if (angleDeg < -45) angleDeg += 90;
  return angleDeg;
}
