import { z } from "zod";

/**
 * Supported PaddleOCR language codes for this project.
 * "german" covers all Latin-script languages (DE, EN, FR, HR, etc.).
 * Add entries here only after verifying PaddleOCR model availability.
 */
const SUPPORTED_OCR_LANGUAGES = ["german", "en", "latin", "french", "spanish", "italian", "portuguese"] as const;

const SUPPORTED_OCR_PROVIDERS = ["paddle", "google", "openai"] as const;

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  AUTH_SECRET: z.string().min(1),
  AUTH_URL: z.string().url(),
  STORAGE_PATH: z.string().min(1),
  OCR_PROVIDER: z.enum(SUPPORTED_OCR_PROVIDERS).default("paddle"),
  OCR_LANGUAGE: z.enum(SUPPORTED_OCR_LANGUAGES).default("german"),
  OCR_SERVICE_URL: z.string().url().default("http://localhost:8868"),
  GOOGLE_APPLICATION_CREDENTIALS: z.string().min(1).optional(),
  GOOGLE_PROJECT_ID: z.string().min(1).optional(),
  GOOGLE_DOCUMENT_AI_LOCATION: z.string().min(1).optional(),
  GOOGLE_PROCESSOR_ID: z.string().min(1).optional(),
  OPENAI_API_KEY: z.string().min(1).optional(),
  OPENAI_MODEL: z.string().min(1).optional(),
  SMTP_ENCRYPTION_KEY: z.string().min(32),
  ADMIN_EMAIL: z.string().email(),
  ADMIN_PASSWORD: z.string().min(8),
  ADMIN_NAME: z.string().min(1),
  EXCHANGE_RATE_API_URL: z.string().url()
}).refine(
  (data) => {
    if (data.OCR_PROVIDER !== "google") return true;
    return !!(
      data.GOOGLE_APPLICATION_CREDENTIALS &&
      data.GOOGLE_PROJECT_ID &&
      data.GOOGLE_DOCUMENT_AI_LOCATION &&
      data.GOOGLE_PROCESSOR_ID
    );
  },
  {
    message:
      "OCR_PROVIDER=google erfordert GOOGLE_APPLICATION_CREDENTIALS, " +
      "GOOGLE_PROJECT_ID, GOOGLE_DOCUMENT_AI_LOCATION und GOOGLE_PROCESSOR_ID.",
  }
).refine(
  (data) => {
    if (data.OCR_PROVIDER !== "openai") return true;
    return !!data.OPENAI_API_KEY;
  },
  {
    message: "OCR_PROVIDER=openai erfordert OPENAI_API_KEY.",
  }
);

export const env = envSchema.parse({
  DATABASE_URL: process.env.DATABASE_URL,
  AUTH_SECRET: process.env.AUTH_SECRET,
  AUTH_URL: process.env.AUTH_URL,
  STORAGE_PATH: process.env.STORAGE_PATH,
  OCR_PROVIDER: process.env.OCR_PROVIDER,
  OCR_LANGUAGE: process.env.OCR_LANGUAGE,
  OCR_SERVICE_URL: process.env.OCR_SERVICE_URL,
  GOOGLE_APPLICATION_CREDENTIALS: process.env.GOOGLE_APPLICATION_CREDENTIALS || undefined,
  GOOGLE_PROJECT_ID: process.env.GOOGLE_PROJECT_ID || undefined,
  GOOGLE_DOCUMENT_AI_LOCATION: process.env.GOOGLE_DOCUMENT_AI_LOCATION || undefined,
  GOOGLE_PROCESSOR_ID: process.env.GOOGLE_PROCESSOR_ID || undefined,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || undefined,
  OPENAI_MODEL: process.env.OPENAI_MODEL || undefined,
  SMTP_ENCRYPTION_KEY: process.env.SMTP_ENCRYPTION_KEY,
  ADMIN_EMAIL: process.env.ADMIN_EMAIL,
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
  ADMIN_NAME: process.env.ADMIN_NAME,
  EXCHANGE_RATE_API_URL: process.env.EXCHANGE_RATE_API_URL
});
