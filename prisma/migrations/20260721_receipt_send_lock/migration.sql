-- P1-4: Idempotenz-/Race-Schutz beim Versand.
-- Nullable-Spalte, die einen laufenden Sendevorgang haelt (atomarer Claim).
ALTER TABLE "Receipt" ADD COLUMN IF NOT EXISTS "sendLockedAt" TIMESTAMP(3);
