-- DropIndex
DROP INDEX "runs_customerId_hermesSessionId_key";

-- AlterTable
ALTER TABLE "runs" ADD COLUMN "hermesTurnId" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "runs_customerId_hermesTurnId_key" ON "runs"("customerId", "hermesTurnId");
