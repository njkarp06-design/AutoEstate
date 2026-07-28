-- Public per-listing reference code, carried in the ad's WhatsApp deep link so
-- the buyer bot resolves the exact property from message one.
--
-- Nullable on purpose: rows created before this migration have no code and are
-- backfilled separately (scripts/backfill-ref-codes.ts). Postgres permits many
-- NULLs in a UNIQUE column, which is what makes this additive rather than a
-- rewrite. Uniqueness is GLOBAL, not per-customer - a future shared buyer
-- number has to resolve a code to a customer before it knows whose data to
-- read, and a code that is only unique within a customer would be useless
-- exactly then.
ALTER TABLE "listings" ADD COLUMN     "refCode" TEXT;

CREATE UNIQUE INDEX "listings_refCode_key" ON "listings"("refCode");

-- The customer's public buyer-facing WhatsApp number, stored as digits. Used
-- only to build the wa.me ad link shown beside each listing's code; the
-- gateway reads its own number from its profile .env, never from here.
ALTER TABLE "customers" ADD COLUMN     "buyerWhatsappNumber" TEXT;
