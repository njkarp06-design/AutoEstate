-- DropIndex
DROP INDEX "runs_customerId_hermesSessionId_key";

-- AlterTable
ALTER TABLE "runs" ADD COLUMN "hermesTurnId" TEXT;

-- Backfill: pre-dates turn-level tracking, so session id is the best
-- available placeholder for any legacy rows (still unique per customer,
-- since it was the previous unique key).
UPDATE "runs" SET "hermesTurnId" = "hermesSessionId" WHERE "hermesTurnId" IS NULL;

-- AlterTable
ALTER TABLE "runs" ALTER COLUMN "hermesTurnId" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "runs_customerId_hermesTurnId_key" ON "runs"("customerId", "hermesTurnId");
