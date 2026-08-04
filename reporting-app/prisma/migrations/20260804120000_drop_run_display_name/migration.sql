-- Drops runs.displayName: no writer has ever existed (neither ingest create
-- branch sets it, and the sync plugin's payload has no such key), so the
-- column was permanently NULL and its two render sites were dead code.
-- Found by the 2026-08-04 /inspect sweep; same rationale as the earlier
-- estimatedCostUsd drop. customers.displayName is a DIFFERENT column and is
-- deliberately kept (operator-set metadata).
ALTER TABLE "runs" DROP COLUMN "displayName";
