/**
 * Assigns a ref code to every Listing created before the column existed.
 *
 * Run once, after the migration, from reporting-app/:
 *   npx tsx scripts/backfill-ref-codes.ts
 *
 * Idempotent - it only touches rows where refCode IS NULL, so re-running is
 * safe and a partial run can simply be repeated. It never regenerates an
 * existing code: once a code is printed in a live ad it must keep resolving to
 * the same property forever.
 */

import dotenv from "dotenv";
import path from "node:path";

// Resolved against this file, NOT process.cwd(): provision-customer.ts shipped
// with the cwd-relative version and could never have worked when run the way
// its own docs told you to. import.meta.url is not an option here - these
// scripts transpile to CJS, where it is a syntax error.
dotenv.config({ path: path.resolve(path.dirname(process.argv[1]), "..", ".env.local") });

async function main() {
  // Imported inside the function, after dotenv has run. A static import hoists
  // above dotenv.config(), leaving DATABASE_URL undefined at module scope -
  // which surfaces as "SASL: client password must be a string", a message that
  // points nowhere near the real cause.
  const { prisma } = await import("../lib/prisma");
  const { generateRefCode } = await import("../lib/ref-code");

  const pending = await prisma.listing.findMany({
    where: { refCode: null },
    select: { id: true, area: true, rooms: true, sqm: true },
  });

  if (pending.length === 0) {
    console.log("Nothing to backfill - every listing already has a ref code.");
    return;
  }

  console.log(`Backfilling ${pending.length} listing(s)…`);

  for (const listing of pending) {
    let assigned: string | null = null;

    // Retry on collision rather than pre-checking: the unique index is the
    // real authority, and a check-then-write here would be racy against the
    // ingest route allocating a code at the same moment.
    for (let attempt = 0; attempt < 8 && assigned === null; attempt++) {
      const code = generateRefCode();
      try {
        await prisma.listing.update({ where: { id: listing.id }, data: { refCode: code } });
        assigned = code;
      } catch (err) {
        const code2 = (err as { code?: string }).code;
        if (code2 !== "P2002") throw err; // only a unique violation is retryable
      }
    }

    if (assigned === null) {
      console.error(`  FAILED ${listing.area} (${listing.id}) - no free code after 8 attempts`);
    } else {
      console.log(`  REF-${assigned}  ${listing.area}, ${listing.rooms} rooms, ${listing.sqm} sqm`);
    }
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    const { prisma } = await import("../lib/prisma");
    await prisma.$disconnect();
  });
