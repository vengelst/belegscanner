export type OcrServiceResult = {
  text: string;
  blocks: Array<{ text: string; confidence: number; box: number[][] }>;
  confidence: number;
};

const IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png"]);

const OCR_TIMEOUT_MS = 30_000;
const HEALTH_TIMEOUT_MS = 3_000;

function getServiceUrl(): string | null {
  return process.env.OCR_SERVICE_URL || null;
}

export async function extractTextWithOcrService(
  buffer: Buffer,
  mimeType: string,
): Promise<OcrServiceResult | null> {
  if (!IMAGE_MIME_TYPES.has(mimeType)) {
    return null;
  }

  const baseUrl = getServiceUrl();
  if (!baseUrl) {
    console.info("[OCR-Service] OCR_SERVICE_URL nicht konfiguriert – uebersprungen");
    return null;
  }

  try {
    const blob = new Blob([new Uint8Array(buffer)], { type: mimeType });
    const extension = mimeType === "image/png" ? "png" : "jpg";
    const formData = new FormData();
    formData.append("file", blob, `document.${extension}`);

    const response = await fetch(`${baseUrl}/ocr/text`, {
      method: "POST",
      body: formData,
      signal: AbortSignal.timeout(OCR_TIMEOUT_MS),
    });

    if (!response.ok) {
      console.warn(
        `[OCR-Service] HTTP ${response.status} – Fallback auf OpenAI Vision`,
      );
      return null;
    }

    const data = (await response.json()) as OcrServiceResult;
    console.info(
      `[OCR-Service] Rohtext extrahiert: ${data.text.length} Zeichen, Confidence ${data.confidence.toFixed(2)}`,
    );
    return data;
  } catch (error) {
    const reason =
      error instanceof Error ? error.message : String(error);
    console.warn(
      `[OCR-Service] Nicht erreichbar (${reason}) – Fallback auf OpenAI Vision`,
    );
    return null;
  }
}

export async function isOcrServiceAvailable(): Promise<boolean> {
  const baseUrl = getServiceUrl();
  if (!baseUrl) return false;

  try {
    const response = await fetch(`${baseUrl}/health`, {
      signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
    });
    if (!response.ok) return false;
    const data = (await response.json()) as { status: string };
    return data.status === "ok";
  } catch {
    return false;
  }
}
