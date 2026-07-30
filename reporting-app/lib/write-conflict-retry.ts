/**
 * Retries a Listing match-and-write that Postgres rejected because another
 * turn won the same race - and only for that.
 *
 * TWO conflict classes, both meaning "someone else got there first, so re-read
 * and try again", and both a silently-lost listing if left unretried:
 *
 *   P2034 / 40001 - serialization failure. Postgres aborts one side of a
 *     concurrent read-then-write under Serializable, and Prisma does NOT retry
 *     an interactive transaction.
 *
 *   P2002 / 23505 - unique constraint violation. Added 2026-07-31 alongside the
 *     partial unique index, and NOT optional: with that index in place the
 *     second inserter BLOCKS on it and then raises a duplicate-key error once
 *     the first commits, so P2002 is the *likely* outcome of a real race -
 *     more likely than 40001, which needs Postgres's SSI to spot the conflict
 *     first. Retrying re-runs the transaction, whose findFirst now sees the
 *     committed row and takes the update branch.
 *
 * WHY THIS EXISTS AT ALL. Without a retry, the Serializable level added to
 * `/api/ingest`'s Listing match-and-write made the failure mode worse rather
 * than better: instead of two duplicate Listing rows, the losing turn threw,
 * the route's blanket catch logged it, and that listing was silently never
 * created or transitioned - the same invisible-failure shape as the original
 * footer bug, in exactly the concurrent scenario the transaction exists to
 * handle (the documented busy_input_mode: interrupt merge quirk, which the
 * route's own comment calls a real scenario rather than a theoretical one).
 *
 * ADDING THE INDEX WITHOUT WIDENING THIS WRAPPER WOULD HAVE REPEATED THAT
 * MISTAKE EXACTLY - a duplicate row traded for a lost listing. The index is
 * the database-level guarantee; this is what keeps its failure mode visible.
 *
 * Still deliberately narrow. Anything that is not one of those two conflict
 * classes rethrows on the FIRST attempt, so a genuine bug surfaces immediately
 * instead of being retried three times and delayed.
 *
 * NOTE ON refCode: a P2002 can in principle come from the globally-unique
 * refCode rather than the listing key. Retrying is correct there too - the
 * transaction re-runs and allocateRefCode draws a fresh code.
 */

const WRITE_CONFLICT_RETRIES = 3;

/**
 * Prisma's codes for the two "another writer won" outcomes, plus their raw
 * SQLSTATEs.
 */
function isWriteConflict(err: unknown): boolean {
  const code = (err as { code?: string } | null | undefined)?.code;
  return code === "P2034" || code === "40001" || code === "P2002" || code === "23505";
}

export async function withWriteConflictRetry<T>(run: () => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await run();
    } catch (err) {
      if (!isWriteConflict(err) || attempt >= WRITE_CONFLICT_RETRIES) throw err;
      console.warn(
        "write-conflict-retry: %s, retrying (attempt %s of %s)",
        (err as { code?: string })?.code,
        attempt,
        WRITE_CONFLICT_RETRIES,
      );
      // Short, growing pause so the two conflicting turns stop colliding.
      await new Promise((resolve) => setTimeout(resolve, 50 * attempt));
    }
  }
}
