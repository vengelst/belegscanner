-- CreateEnum
CREATE TYPE "PartyRole" AS ENUM ('CREDITOR', 'DEBTOR');

-- AlterTable
ALTER TABLE "Receipt" ADD COLUMN "partyRole" "PartyRole" NOT NULL DEFAULT 'CREDITOR';
