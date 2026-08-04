-- Idempotent: User darf Belege ohne APPROVED-Pruefstatus an DATEV senden (Admin-gesteuert)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "canSendWithoutApproval" BOOLEAN NOT NULL DEFAULT false;
