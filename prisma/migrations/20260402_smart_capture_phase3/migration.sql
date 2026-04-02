-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('GENERAL', 'FUEL', 'HOSPITALITY', 'LODGING');

-- AlterTable
ALTER TABLE "Receipt"
ADD COLUMN "detectedDocumentType" "DocumentType",
ADD COLUMN "ocrStructuredData" JSONB;

-- CreateIndex
CREATE INDEX "Receipt_detectedDocumentType_idx" ON "Receipt"("detectedDocumentType");
