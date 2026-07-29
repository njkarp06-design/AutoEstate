/**
 * Retries a Serializable transaction that Postgres aborted for a serialization
 * failure, and only for that.
 *
 * WHY THIS IS NEEDED. Postgres aborts one side of a concurrent read-then-write
 * under Serializable (SQLSTATE 40001, surfaced by Prisma as P2034), and Prisma
 * does NOT retry an interactive transaction. Without a retry, the isolation
 * level added to `/api/ingest`'s Listing match-and-write made the failure mode
 * worse rather than better: instead of two duplicate Listing rows, the losing
 * turn threw, the route's blanket catch logged it, and that listing was silently
 * never created or transitioned - the same invisible-failure shape as the
 * original footer bug, in exactly the concurrent scenario the transaction exists
 * to handle (the documented busy_input_mode: interrupt merge quirk, which the
 * route's own comment calls a real scenario rather than a theoretical one).
 *
 * Deliberately narrow. Anything that is not a serialization failure rethrows on
 * the FIRST attempt, so a genuine bug surfaces immediately instead of being
 * retried three times and delayed.
 *
 * THIS DOES NOT CLOSE THE DATABASE-LEVEL GAP, and should not be read as having
 * done so. The durable guarantee is the partial expression index
 * `UNIQUE (customerId, lower(area), rooms, sqm) WHERE status <> 'SOLD'` - a
 * partial *expression* index specifically, because the ingest lookup is
 * case-insensitive and excludes SOLD on purpose, so a plain
 * `@@unique([customerId, area, rooms, sqm])` would wrongly block a legitimate
 * relist of a sold property. That needs a migration and stays tracked in
 * TODO.md as a pre-Vercel deploy gate.
 */

const SERIALIZATION_RETRIES = 3;

/** Prisma's code for a write conflict / serialization failure, and the raw SQLSTATE. */
function isSerializationFailure(err: unknown): boolean {
  const code = (err as { code?: string } | null | undefined)?.code;
  return code === "P2034" || code === "40001";
}

export async function withSerializationRetry<T>(run: () => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await run();
    } catch (err) {
      if (!isSerializationFailure(err) || attempt >= SERIALIZATION_RETRIES) throw err;
      console.warn(
        "serialization-retry: transaction aborted with a write conflict, retrying (attempt %s of %s)",
        attempt,
        SERIALIZATION_RETRIES,
      );
      // Short, growing pause so the two conflicting turns stop colliding.
      await new Promise((resolve) => setTimeout(resolve, 50 * attempt));
    }
  }
}
