-- AlterTable
ALTER TABLE "OrganizationProfile" ADD COLUMN     "companyCardLastDigits" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Vorbelegung der bekannten Firmenkarten: 2454 (Sparkasse), 2350 (Apple Wallet).
UPDATE "OrganizationProfile"
SET "companyCardLastDigits" = ARRAY['2454', '2350']
WHERE "companyCardLastDigits" IS NULL OR cardinality("companyCardLastDigits") = 0;

-- Falls noch kein Firmenprofil existiert, eines mit den Firmenkarten anlegen.
INSERT INTO "OrganizationProfile" ("id", "legalName", "companyCardLastDigits", "createdAt", "updatedAt")
SELECT 'default', '', ARRAY['2454', '2350'], CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "OrganizationProfile");
