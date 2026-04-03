import { z } from "zod";

/**
 * Supported PaddleOCR language codes for this project.
 * "german" covers all Latin-script languages (DE, EN, FR, HR, etc.).
 * Add entries here only after verifying PaddleOCR model availability.
 */
const SUPPORTED_OCR_LANGUAGES = ["german", "en", "latin", "french", "spanish", "italian", "portuguese"] as const;

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  AUTH_SECRET: z.string().min(1),
  AUTH_URL: z.string().url(),
  STORAGE_PATH: z.string().min(1),
  OCR_LANGUAGE: z.enum(SUPPORTED_OCR_LANGUAGES).default("german"),
  OCR_SERVICE_URL: z.string().url().default("http://localhost:8868"),
  SMTP_ENCRYPTION_KEY: z.string().min(32),
  ADMIN_EMAIL: z.string().email(),
  ADMIN_PASSWORD: z.string().min(8),
  ADMIN_NAME: z.string().min(1),
  EXCHANGE_RATE_API_URL: z.string().url()
});

export const env = envSchema.parse({
  DATABASE_URL: process.env.DATABASE_URL,
  AUTH_SECRET: process.env.AUTH_SECRET,
  AUTH_URL: process.env.AUTH_URL,
  STORAGE_PATH: process.env.STORAGE_PATH,
  OCR_LANGUAGE: process.env.OCR_LANGUAGE,
  OCR_SERVICE_URL: process.env.OCR_SERVICE_URL,
  SMTP_ENCRYPTION_KEY: process.env.SMTP_ENCRYPTION_KEY,
  ADMIN_EMAIL: process.env.ADMIN_EMAIL,
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
  ADMIN_NAME: process.env.ADMIN_NAME,
  EXCHANGE_RATE_API_URL: process.env.EXCHANGE_RATE_API_URL
});

