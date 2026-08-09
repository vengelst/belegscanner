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
    /** Laplacian-Varianz im Dokumentbereich. Hoeher = schaerfer. */
    sharpness: number;
    motion: number;
    coverage: number;
    rectangularity: number;
  };
  hint: string;
  autoCaptureEligible: boolean;
  /**
   * Nur eine Metrik liegt knapp neben ihrem Schwellwert. Der Aufrufer nutzt das
   * fuer eine Grace-Phase, damit ein einzelner Wackel-Frame den Auto-Capture
   * nicht komplett zuruecksetzt.
   */
  nearReady: boolean;
};

/** Anteil der Pixel, die als starke Kante erkannt sein muessen (aufloesungsunabhaengig). */
const MIN_EDGE_PIXEL_RATIO = 0.0012;
const MIN_EDGE_PIXELS_FLOOR = 90;
const EDGE_THRESHOLD_MULTIPLIER = 1.45;
const MIN_EDGE_THRESHOLD = 16;
const MIN_COVERAGE = 0.08;
const MAX_COVERAGE = 0.99;
const MIN_RECTANGULARITY = 0.10;
const MIN_CONTRAST = 10;
const MIN_BRIGHTNESS = 28;
const MAX_BRIGHTNESS = 248;
const MIN_SHARPNESS = 8;
const MAX_MOTION = 0.28;

/**
 * Auto-Capture: sobald ein Belegausschnitt erkannt ist.
 * Schaerfe/Rechteckigkeit/Motion beeinflussen nur den Ready-Hinweis,
 * blockieren das Ausloesen nicht.
 */
const AUTO_MIN_COVERAGE = 0.04;
const AUTO_MAX_COVERAGE = 0.999;
const AUTO_MIN_BRIGHTNESS = 12;
const AUTO_MAX_BRIGHTNESS = 255;

/** Toleranzbaender fuer "knapp daneben" (siehe nearReady). */
const SLACK_COVERAGE = 0.05;
const SLACK_RECTANGULARITY = 0.06;
const SLACK_CONTRAST = 4;
const SLACK_BRIGHTNESS = 10;
const SLACK_SHARPNESS = 8;
const SLACK_MOTION = 0.1;

type MetricCheck = { ok: boolean; near: boolean };

function checkRange(value: number, min: number, max: number, slack: number): MetricCheck {
  return {
    ok: value >= min && value <= max,
    near: value >= min - slack && value <= max + slack,
  };
}

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
  const edgeThreshold = Math.max(MIN_EDGE_THRESHOLD, meanEdge * EDGE_THRESHOLD_MULTIPLIER);

  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const index = y * width + x;
      const magnitude = edgeValues[index];
      if (magnitude < edgeThreshold) continue;
      edgePoints.push({ x, y, magnitude });
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }

  const minEdgePixels = Math.max(MIN_EDGE_PIXELS_FLOOR, Math.round(pixelCount * MIN_EDGE_PIXEL_RATIO));
  if (edgePoints.length < minEdgePixels) {
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
  const sharpness = computeLaplacianVariance(grayscale, width, height, minX, minY, maxX, maxY);

  const normalizedBounds: NormalizedDocumentBounds = {
    x: minX / width,
    y: minY / height,
    width: boxWidth / width,
    height: boxHeight / height,
  };
  const motion = computeMotion(previousBounds, normalizedBounds);
  const angleDeg = computePrimaryAngle(edgePoints);

  const checks = [
    checkRange(coverage, MIN_COVERAGE, MAX_COVERAGE, SLACK_COVERAGE),
    checkRange(rectangularity, MIN_RECTANGULARITY, Number.POSITIVE_INFINITY, SLACK_RECTANGULARITY),
    checkRange(contrast, MIN_CONTRAST, Number.POSITIVE_INFINITY, SLACK_CONTRAST),
    checkRange(meanBrightness, MIN_BRIGHTNESS, MAX_BRIGHTNESS, SLACK_BRIGHTNESS),
    checkRange(sharpness, MIN_SHARPNESS, Number.POSITIVE_INFINITY, SLACK_SHARPNESS),
    checkRange(motion, 0, MAX_MOTION, SLACK_MOTION),
  ];

  const failedChecks = checks.filter((check) => !check.ok);
  const metrics = {
    brightness: meanBrightness,
    contrast,
    sharpness,
    motion,
    coverage,
    rectangularity,
  };

  // Auto-Capture: Bounds erkannt = Beleg da. Qualitaetsmetriken nur fuer Status/Hinweis.
  const autoCaptureEligible =
    coverage >= AUTO_MIN_COVERAGE
    && coverage <= AUTO_MAX_COVERAGE
    && meanBrightness >= AUTO_MIN_BRIGHTNESS
    && meanBrightness <= AUTO_MAX_BRIGHTNESS;

  if (failedChecks.length === 0) {
    return {
      status: "ready",
      bounds: normalizedBounds,
      angleDeg,
      metrics,
      hint: "Beleg erkannt - stillhalten fuer Auto-Capture",
      autoCaptureEligible: true,
      nearReady: true,
    };
  }

  return {
    status: "uncertain",
    bounds: normalizedBounds,
    angleDeg,
    metrics,
    hint: autoCaptureEligible
      ? "Beleg erkannt - Aufnahme folgt, bitte stillhalten"
      : buildHint({ coverage, rectangularity, meanBrightness, contrast, sharpness, motion }),
    autoCaptureEligible,
    nearReady: autoCaptureEligible || (failedChecks.length === 1 && failedChecks[0].near),
  };
}

function buildHint({
  coverage,
  rectangularity,
  meanBrightness,
  contrast,
  sharpness,
  motion,
}: {
  coverage: number;
  rectangularity: number;
  meanBrightness: number;
  contrast: number;
  sharpness: number;
  motion: number;
}) {
  if (coverage < MIN_COVERAGE) return "Naeher an den Beleg herangehen";
  if (coverage > MAX_COVERAGE) return "Etwas weiter weg gehen";
  if (rectangularity < MIN_RECTANGULARITY) return "Beleg vollstaendig im Rahmen platzieren";
  if (motion > MAX_MOTION) return "Kamera ruhiger halten";
  if (sharpness < MIN_SHARPNESS) return "Bild ist zu unscharf";
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
      sharpness: 0,
      motion: previousBounds ? 1 : 0,
      coverage: 0,
      rectangularity: 0,
    },
    hint,
    autoCaptureEligible: false,
    nearReady: false,
  };
}

/**
 * Laplacian-Varianz als Schaerfemass, begrenzt auf den Dokumentbereich.
 * Der reine Sobel-Mittelwert reagiert zu stark auf Kontrast statt auf Schaerfe
 * und liess dadurch auch verwackelte Frames als "scharf" durchgehen.
 */
function computeLaplacianVariance(
  grayscale: Float32Array,
  width: number,
  height: number,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
) {
  const startX = Math.max(1, minX);
  const endX = Math.min(width - 2, maxX);
  const startY = Math.max(1, minY);
  const endY = Math.min(height - 2, maxY);

  let sum = 0;
  let sumOfSquares = 0;
  let count = 0;

  for (let y = startY; y <= endY; y += 1) {
    for (let x = startX; x <= endX; x += 1) {
      const index = y * width + x;
      const laplacian =
        4 * grayscale[index]
        - grayscale[index - 1]
        - grayscale[index + 1]
        - grayscale[index - width]
        - grayscale[index + width];
      sum += laplacian;
      sumOfSquares += laplacian * laplacian;
      count += 1;
    }
  }

  if (count === 0) return 0;
  const mean = sum / count;
  return Math.max(0, sumOfSquares / count - mean * mean);
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
