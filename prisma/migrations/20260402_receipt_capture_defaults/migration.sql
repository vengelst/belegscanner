ALTER TABLE "User"
ADD COLUMN "defaultCountryId" TEXT,
ADD COLUMN "defaultVehicleId" TEXT,
ADD COLUMN "defaultPurposeId" TEXT,
ADD COLUMN "defaultCategoryId" TEXT;

CREATE INDEX "User_defaultCountryId_idx" ON "User"("defaultCountryId");
CREATE INDEX "User_defaultVehicleId_idx" ON "User"("defaultVehicleId");
CREATE INDEX "User_defaultPurposeId_idx" ON "User"("defaultPurposeId");
CREATE INDEX "User_defaultCategoryId_idx" ON "User"("defaultCategoryId");

ALTER TABLE "User"
ADD CONSTRAINT "User_defaultCountryId_fkey" FOREIGN KEY ("defaultCountryId") REFERENCES "Country"("id") ON DELETE SET NULL ON UPDATE CASCADE,
ADD CONSTRAINT "User_defaultVehicleId_fkey" FOREIGN KEY ("defaultVehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE,
ADD CONSTRAINT "User_defaultPurposeId_fkey" FOREIGN KEY ("defaultPurposeId") REFERENCES "Purpose"("id") ON DELETE SET NULL ON UPDATE CASCADE,
ADD CONSTRAINT "User_defaultCategoryId_fkey" FOREIGN KEY ("defaultCategoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
