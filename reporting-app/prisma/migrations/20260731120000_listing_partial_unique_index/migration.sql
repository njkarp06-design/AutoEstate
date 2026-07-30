-- The durable, database-level fix for the /api/ingest Listing dedupe race.
--
-- Two turns for the same property arriving close together - which the
-- documented busy_input_mode: interrupt merge quirk makes a real scenario -
-- could both miss the match query and both INSERT, leaving duplicate Listing
-- rows that no UI can merge or delete. The Serializable transaction added on
-- 2026-07-27 removes that on the application code path; this is the guarantee
-- that does not depend on the code path being taken.
--
-- WHY A PARTIAL EXPRESSION INDEX AND NOT @@unique.
-- The ingest lookup is case-insensitive AND excludes SOLD on purpose, so a
-- sold row plus a relisted active row for the same property is two rows BY
-- DESIGN. A plain @@unique([customerId, area, rooms, sqm]) is case-sensitive
-- and status-blind, and would wrongly block a legitimate relist. Prisma can
-- express neither lower() nor a WHERE predicate, so this is raw SQL and stays
-- invisible to schema.prisma - which is why it must never be "tidied" into an
-- @@unique attribute later.
--
-- Safe to apply: verified against the dev database beforehand that zero rows
-- violate it (0 duplicate groups among 4 ACTIVE / 3 SOLD listings).
--
-- Callers must handle P2002: with this index in place the losing side of a
-- race gets a duplicate-key error rather than creating a second row, and an
-- unretried P2002 would be swallowed by the ingest route's catch and turn a
-- duplicate row into a silently-lost listing. lib/write-conflict-retry.ts
-- retries it; see the comment there.
CREATE UNIQUE INDEX "listings_customer_area_rooms_sqm_active_key"
  ON "listings" ("customerId", lower("area"), "rooms", "sqm")
  WHERE "status" <> 'SOLD';
