import sharp from "sharp";

const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 85;
const MAX_FILE_SIZE = 1.5 * 1024 * 1024; // 1.5 MB

/**
 * Optimizes large images for PDF embedding.
 * Images larger than 1.5 MB are resized and compressed to avoid
 * issues with @react-pdf/renderer when handling very large base64 images.
 */
export async function optimizeImageForPdf(
  buffer: Buffer,
  mimeType: string,
): Promise<{ buffer: Buffer; mimeType: string }> {
  // Only process images, not PDFs
  if (!mimeType.startsWith("image/")) {
    return { buffer, mimeType };
  }

  // If already small enough, return as-is
  if (buffer.length <= MAX_FILE_SIZE) {
    return { buffer, mimeType };
  }

  // Resize and compress with sharp
  const optimized = await sharp(buffer)
    .resize(MAX_DIMENSION, MAX_DIMENSION, {
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: JPEG_QUALITY })
    .toBuffer();

  return {
    buffer: optimized,
    mimeType: "image/jpeg",
  };
}
