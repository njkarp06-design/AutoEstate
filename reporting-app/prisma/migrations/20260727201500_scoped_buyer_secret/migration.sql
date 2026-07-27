-- Split the single per-customer machine credential into two role-scoped ones.
--
-- HAND-WRITTEN AS A RENAME, deliberately. Prisma cannot detect a column rename
-- and generates DROP + ADD, which it warned would discard "1 non-null value" -
-- that value being the live customer's real operator secret hash. Dropping it
-- would have locked the running operator gateway out of /api/ingest until the
-- secret was regenerated and re-injected. A rename preserves it, so the
-- operator instance keeps authenticating with the credential it already holds
-- and nothing needs redeploying on that side.
ALTER TABLE "customers" RENAME COLUMN "ingestionSecretHash" TO "operatorSecretHash";
ALTER INDEX "customers_ingestionSecretHash_key" RENAME TO "customers_operatorSecretHash_key";

-- The buyer instance's own credential. Nullable: a customer has one only once
-- a buyer instance is provisioned for them, and Postgres permits many NULLs in
-- a unique column, so every not-yet-provisioned customer can sit at NULL
-- without colliding.
ALTER TABLE "customers" ADD COLUMN "buyerSecretHash" TEXT;
CREATE UNIQUE INDEX "customers_buyerSecretHash_key" ON "customers"("buyerSecretHash");
