import { describe, expect, it } from "vitest";
import { analyzeDocumentFrame } from "@/components/receipts/document-detector";

type Frame = { width: number; height: number; data: Uint8ClampedArray };

/**
 * Synthetischer Kamera-Frame: dunkler Hintergrund, heller Belegausschnitt mit
 * dunklen Textbalken. Reicht, um Kanten-, Schaerfe- und Bewegungslogik zu pruefen.
 */
function buildDocumentFrame(width: number, height: number): Frame {
  const data = new Uint8ClampedArray(width * height * 4);
  const left = Math.round(width * 0.08);
  const right = Math.round(width * 0.92);
  const top = Math.round(height * 0.09);
  const bottom = Math.round(height * 0.91);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const insideDocument = x >= left && x <= right && y >= top && y <= bottom;
      // Textbalken innerhalb des Belegs, damit es echte Hochfrequenz gibt.
      const textRow = insideDocument
        && x > left + 4
        && x < right - 4
        && (y - top) % 10 < 3
        && y > top + 6
        && y < bottom - 6;

      const value = insideDocument ? (textRow ? 25 : 235) : 30;
      const offset = (y * width + x) * 4;
      data[offset] = value;
      data[offset + 1] = value;
      data[offset + 2] = value;
      data[offset + 3] = 255;
    }
  }

  return { width, height, data };
}

/** Kastenweichzeichner, um einen verwackelten Frame zu simulieren. */
function blurFrame(frame: Frame, radius: number): Frame {
  const { width, height } = frame;
  const source = frame.data;
  const data = new Uint8ClampedArray(source.length);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let sum = 0;
      let count = 0;
      for (let dy = -radius; dy <= radius; dy += 1) {
        for (let dx = -radius; dx <= radius; dx += 1) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          sum += source[(ny * width + nx) * 4];
          count += 1;
        }
      }
      const value = sum / count;
      const offset = (y * width + x) * 4;
      data[offset] = value;
      data[offset + 1] = value;
      data[offset + 2] = value;
      data[offset + 3] = 255;
    }
  }

  return { width, height, data };
}

function analyze(frame: Frame, previousBounds: Parameters<typeof analyzeDocumentFrame>[1] = null) {
  return analyzeDocumentFrame(frame as unknown as ImageData, previousBounds);
}

describe("analyzeDocumentFrame", () => {
  it("findet den Belegausschnitt und liefert plausible Bounds", () => {
    const result = analyze(buildDocumentFrame(160, 220));

    expect(result.status).not.toBe("not_found");
    expect(result.bounds).not.toBeNull();
    expect(result.bounds!.x).toBeGreaterThan(0.02);
    expect(result.bounds!.x).toBeLessThan(0.2);
    expect(result.bounds!.width).toBeGreaterThan(0.6);
    expect(result.metrics.coverage).toBeGreaterThan(0.5);
  });

  it("erkennt einen leeren Frame als not_found", () => {
    const width = 160;
    const height = 220;
    const data = new Uint8ClampedArray(width * height * 4).fill(120);
    for (let index = 3; index < data.length; index += 4) data[index] = 255;

    const result = analyze({ width, height, data });

    expect(result.status).toBe("not_found");
    expect(result.bounds).toBeNull();
    expect(result.nearReady).toBe(false);
  });

  it("bewertet einen verwackelten Frame deutlich unschaerfer (Laplacian-Varianz)", () => {
    const sharp = analyze(buildDocumentFrame(160, 220));
    const blurred = analyze(blurFrame(buildDocumentFrame(160, 220), 3));

    expect(sharp.metrics.sharpness).toBeGreaterThan(blurred.metrics.sharpness * 2);
  });

  it("skaliert die Kantenschwelle mit der Analyseaufloesung", () => {
    // 400px-Frames (neue ANALYSIS_WIDTH) muessen genauso erkannt werden wie kleine.
    const small = analyze(buildDocumentFrame(240, 320));
    const large = analyze(buildDocumentFrame(400, 533));

    expect(small.bounds).not.toBeNull();
    expect(large.bounds).not.toBeNull();
    expect(Math.abs(small.metrics.coverage - large.metrics.coverage)).toBeLessThan(0.05);
  });

  it("meldet zu starke Bewegung und blockiert Auto-Capture", () => {
    const frame = buildDocumentFrame(160, 220);
    const stable = analyze(frame);
    const shifted = analyze(frame, {
      x: stable.bounds!.x - 0.55,
      y: stable.bounds!.y,
      width: stable.bounds!.width,
      height: stable.bounds!.height,
    });

    expect(shifted.metrics.motion).toBeGreaterThan(0.35);
    expect(shifted.autoCaptureEligible).toBe(false);
    expect(shifted.hint).toBe("Kamera ruhiger halten");
  });

  it("laesst Auto-Capture auch bei imperfectem Ready-Status zu", () => {
    const result = analyze(buildDocumentFrame(160, 220));

    expect(result.bounds).not.toBeNull();
    expect(result.autoCaptureEligible).toBe(true);
  });
});
