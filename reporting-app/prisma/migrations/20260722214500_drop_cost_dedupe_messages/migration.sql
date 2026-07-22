-- AlterTable
-- estimatedCostUsd was never populated by the ingest route or the
-- sync-to-webapp plugin's payload - dead column.
ALTER TABLE "runs" DROP COLUMN "estimatedCostUsd";

-- CreateIndex
-- Lets the ingest route use skipDuplicates on message inserts, so a
-- duplicate turn_completed delivery can't double a run's transcript.
CREATE UNIQUE INDEX "run_messages_runId_role_sortIndex_key" ON "run_messages"("runId", "role", "sortIndex");
