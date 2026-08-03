-- Catch-up migration: Adds schema elements that were applied manually on prod
-- but had no migration file. Safe to re-run (uses IF NOT EXISTS / IF NOT EXISTS patterns).

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "ReviewStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'APPROVED', 'DEFERRED', 'COMPLETED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AlterTable Receipt: add missing columns
ALTER TABLE "Receipt" ADD COLUMN IF NOT EXISTS "invoiceNumber" VARCHAR(80);
ALTER TABLE "Receipt" ADD COLUMN IF NOT EXISTS "serviceDate" DATE;
ALTER TABLE "Receipt" ADD COLUMN IF NOT EXISTS "dueDate" DATE;
ALTER TABLE "Receipt" ADD COLUMN IF NOT EXISTS "netAmount" DECIMAL(12,2);
ALTER TABLE "Receipt" ADD COLUMN IF NOT EXISTS "taxAmount" DECIMAL(12,2);
ALTER TABLE "Receipt" ADD COLUMN IF NOT EXISTS "datevProfileId" TEXT;
ALTER TABLE "Receipt" ADD COLUMN IF NOT EXISTS "reviewStatus" "ReviewStatus" NOT NULL DEFAULT 'DRAFT';
ALTER TABLE "Receipt" ADD COLUMN IF NOT EXISTS "reviewedById" TEXT;
ALTER TABLE "Receipt" ADD COLUMN IF NOT EXISTS "reviewedAt" TIMESTAMP(3);
ALTER TABLE "Receipt" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

-- CreateTable ReceiptComment
CREATE TABLE IF NOT EXISTS "ReceiptComment" (
    "id" TEXT NOT NULL,
    "receiptId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReceiptComment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (idempotent via IF NOT EXISTS)
CREATE INDEX IF NOT EXISTS "Receipt_reviewStatus_idx" ON "Receipt"("reviewStatus");
CREATE INDEX IF NOT EXISTS "Receipt_datevProfileId_idx" ON "Receipt"("datevProfileId");
CREATE INDEX IF NOT EXISTS "Receipt_invoiceNumber_idx" ON "Receipt"("invoiceNumber");
CREATE INDEX IF NOT EXISTS "Receipt_serviceDate_idx" ON "Receipt"("serviceDate");
CREATE INDEX IF NOT EXISTS "Receipt_dueDate_idx" ON "Receipt"("dueDate");
CREATE INDEX IF NOT EXISTS "Receipt_deletedAt_idx" ON "Receipt"("deletedAt");
CREATE INDEX IF NOT EXISTS "ReceiptComment_receiptId_createdAt_idx" ON "ReceiptComment"("receiptId", "createdAt");

-- AddForeignKey (idempotent check)
DO $$ BEGIN
  ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_datevProfileId_fkey"
    FOREIGN KEY ("datevProfileId") REFERENCES "DatevProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_reviewedById_fkey"
    FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "ReceiptComment" ADD CONSTRAINT "ReceiptComment_receiptId_fkey"
    FOREIGN KEY ("receiptId") REFERENCES "Receipt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "ReceiptComment" ADD CONSTRAINT "ReceiptComment_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
