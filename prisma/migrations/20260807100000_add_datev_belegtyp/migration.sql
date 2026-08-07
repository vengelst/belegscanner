-- CreateEnum
CREATE TYPE "DatevBelegtyp" AS ENUM ('RECHNUNGSEINGANG', 'RECHNUNGSAUSGANG', 'KASSE', 'KREDITKARTENBELEGE', 'SONSTIGE', 'REISEKOSTEN');

-- AlterTable
ALTER TABLE "Receipt" ADD COLUMN     "datevBelegtyp" "DatevBelegtyp";

-- CreateIndex
CREATE INDEX "Receipt_datevBelegtyp_idx" ON "Receipt"("datevBelegtyp");

-- CreateTable
CREATE TABLE "DatevBelegtypAddress" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "belegtyp" "DatevBelegtyp" NOT NULL,
    "datevAddress" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DatevBelegtypAddress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DatevBelegtypAddress_profileId_idx" ON "DatevBelegtypAddress"("profileId");

-- CreateIndex
CREATE UNIQUE INDEX "DatevBelegtypAddress_profileId_belegtyp_key" ON "DatevBelegtypAddress"("profileId", "belegtyp");

-- AddForeignKey
ALTER TABLE "DatevBelegtypAddress" ADD CONSTRAINT "DatevBelegtypAddress_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "DatevProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: bestehende Belege bekommen einen Belegtyp nach Belegrichtung und Kategorie.
-- Reihenfolge entspricht der UI-Vorbelegung (suggestDatevBelegtyp).
UPDATE "Receipt" AS r
SET "datevBelegtyp" = CASE
    WHEN r."partyRole" = 'DEBTOR' THEN 'RECHNUNGSAUSGANG'::"DatevBelegtyp"
    WHEN c."name" ILIKE '%kasse%' THEN 'KASSE'::"DatevBelegtyp"
    WHEN c."name" ILIKE '%kreditkarte%' THEN 'KREDITKARTENBELEGE'::"DatevBelegtyp"
    WHEN c."name" ILIKE '%reise%' THEN 'REISEKOSTEN'::"DatevBelegtyp"
    ELSE 'RECHNUNGSEINGANG'::"DatevBelegtyp"
END
FROM "Category" AS c
WHERE c."id" = r."categoryId"
  AND r."datevBelegtyp" IS NULL;

-- Backfill: bestehende Profil-Standardadresse als Upload-Mail fuer Rechnungseingang uebernehmen.
INSERT INTO "DatevBelegtypAddress" ("id", "profileId", "belegtyp", "datevAddress", "createdAt", "updatedAt")
SELECT
    md5(random()::text || clock_timestamp()::text || p."id"),
    p."id",
    'RECHNUNGSEINGANG'::"DatevBelegtyp",
    p."datevAddress",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "DatevProfile" AS p
WHERE p."datevAddress" <> '';
