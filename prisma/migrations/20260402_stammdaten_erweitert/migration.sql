-- Delta-Migration: stammdaten_erweitert
-- Ersetzt die fruehere Voll-Kopie von init. Idempotent fuer frische DBs nach 20260401_init.
-- Aenderungen gegenueber init:
--   Country.code nullable + currencyCode
--   SmtpConfig: datevAddress entfernt, replyToAddress hinzugefuegt
--   DatevProfile-Tabelle

-- Country: code optional + currencyCode
ALTER TABLE "Country" ALTER COLUMN "code" DROP NOT NULL;
ALTER TABLE "Country" ADD COLUMN IF NOT EXISTS "currencyCode" VARCHAR(3);

-- SmtpConfig: DATEV-Adresse raus, Reply-To rein
ALTER TABLE "SmtpConfig" ADD COLUMN IF NOT EXISTS "replyToAddress" TEXT;
ALTER TABLE "SmtpConfig" DROP COLUMN IF EXISTS "datevAddress";

-- DatevProfile
CREATE TABLE IF NOT EXISTS "DatevProfile" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "datevAddress" TEXT NOT NULL,
    "senderAddress" TEXT NOT NULL,
    "subjectTemplate" TEXT,
    "bodyTemplate" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DatevProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "DatevProfile_name_key" ON "DatevProfile"("name");
CREATE INDEX IF NOT EXISTS "DatevProfile_active_isDefault_idx" ON "DatevProfile"("active", "isDefault");
