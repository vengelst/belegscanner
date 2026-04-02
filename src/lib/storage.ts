import fs from "fs/promises";
import path from "path";

const STORAGE_ROOT = process.env.STORAGE_PATH ?? "./storage";

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "application/pdf",
]);

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

export type StorageResult = {
  storagePath: string;
  sizeBytes: number;
  mimeType: string;
  filename: string;
};

export function validateFile(mimeType: string, sizeBytes: number): string | null {
  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    return `Dateityp ${mimeType} ist nicht erlaubt. Erlaubt: JPG, PNG, PDF.`;
  }
  if (sizeBytes > MAX_FILE_SIZE) {
    return `Datei ist zu gross (${(sizeBytes / 1024 / 1024).toFixed(1)} MB). Maximum: 20 MB.`;
  }
  return null;
}

function receiptDir(receiptId: string): string {
  return path.join(STORAGE_ROOT, "receipts", receiptId);
}

function extFromMime(mimeType: string): string {
  switch (mimeType) {
    case "image/jpeg": return ".jpg";
    case "image/png": return ".png";
    case "application/pdf": return ".pdf";
    default: return ".bin";
  }
}

export async function saveOriginalFile(
  receiptId: string,
  buffer: Buffer,
  mimeType: string,
  originalFilename: string,
): Promise<StorageResult> {
  const dir = receiptDir(receiptId);
  await fs.mkdir(dir, { recursive: true });

  const ext = extFromMime(mimeType);
  const storedName = `original${ext}`;
  const storagePath = path.join("receipts", receiptId, storedName);
  const fullPath = path.join(STORAGE_ROOT, storagePath);

  await fs.writeFile(fullPath, buffer);

  return {
    storagePath,
    sizeBytes: buffer.length,
    mimeType,
    filename: originalFilename,
  };
}

export async function readFile(storagePath: string): Promise<Buffer> {
  const fullPath = path.join(STORAGE_ROOT, storagePath);
  return fs.readFile(fullPath);
}

export async function fileExists(storagePath: string): Promise<boolean> {
  try {
    await fs.access(path.join(STORAGE_ROOT, storagePath));
    return true;
  } catch {
    return false;
  }
}
