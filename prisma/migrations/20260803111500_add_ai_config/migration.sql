-- CreateTable
CREATE TABLE "AiConfig" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "provider" TEXT NOT NULL DEFAULT 'openai',
    "model" TEXT NOT NULL DEFAULT 'gpt-4o-mini',
    "apiKeyEnc" TEXT,
    "baseUrl" TEXT,
    "ocrServiceUrl" TEXT DEFAULT 'http://ocr-service:8000',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiConfig_pkey" PRIMARY KEY ("id")
);
