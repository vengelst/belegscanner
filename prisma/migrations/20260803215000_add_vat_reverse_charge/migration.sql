-- AlterTable
ALTER TABLE "Country" ADD COLUMN "vatRatePercent" DECIMAL(5,2);

-- AlterTable
ALTER TABLE "Receipt" ADD COLUMN "reverseCharge" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Receipt" ADD COLUMN "vatRatePercent" DECIMAL(5,2);
