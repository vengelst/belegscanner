-- Standard-Belegtyp und eigene Bezeichnungen je Belegtyp am Firmenprofil.
-- Bestandszeilen starten mit Rechnungseingang und ohne eigene Bezeichnungen.
-- AlterTable
ALTER TABLE "OrganizationProfile" ADD COLUMN     "datevBelegtypLabelOverrides" JSONB,
ADD COLUMN     "defaultDatevBelegtyp" "DatevBelegtyp" NOT NULL DEFAULT 'RECHNUNGSEINGANG';
