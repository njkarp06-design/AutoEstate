/**
 * Removes Run rows that are Hermes's own background-review housekeeping turns
 * rather than customer activity - see lib/hermes-harness.ts for what they are
 * and why they were ever ingested.
 *
 * `/api/ingest` now rejects them at the door, so this is only needed for rows
 * that landed before that filter existed. Run once per database:
 *
 *   npx tsx scripts/delete-background-review-runs.ts           # dry run, prints only
 *   npx tsx scripts/delete-background-review-runs.ts --apply   # actually deletes
 *
 * Dry run by default on purpose: this deletes customer-scoped rows, and the
 * matching predicate is the only thing standing between "Hermes's internal
 * monologue" and "a real listing the agent sent". Read the printed list before
 * passing --apply.
 *
 * Idempotent - re-running finds nothing once the rows are gone. RunMessage and
 * RunPlatformContent cascade on the Run's deletion (see schema.prisma).
 */

import dotenv from "dotenv";
import path from "node:path";

// Resolved against this file, never process.cwd() - same reasoning as
// provision-customer.ts, which shipped with the cwd-relative version and could
// never have worked when run the way its own docs told you to.
dotenv.config({ path: path.resolve(path.dirname(process.argv[1]), "..", ".env.local") });

async function main() {
  // Imported inside the function, after dotenv has run: a static import hoists
  // above dotenv.config(), leaving DATABASE_URL undefined at module scope.
  const { prisma } = await import("../lib/prisma");
  const { isBackgroundReviewTurn } = await import("../lib/hermes-harness");

  const apply = process.argv.includes("--apply");

  const runs = await prisma.run.findMany({
    orderBy: { startedAt: "asc" },
    include: {
      messages: { orderBy: { sortIndex: "asc" } },
      customer: { select: { email: true } },
    },
  });

  // Matched on the run's own user message, not its title: the title is a
  // 60-char truncation and a future prompt could be reworded within it.
  const targets = runs.filter((run) =>
    run.messages.some((m) => m.role === "user" && isBackgroundReviewTurn(m.content)),
  );

  if (targets.length === 0) {
    console.log(`Nothing to delete - none of the ${runs.length} runs is a background-review turn.`);
    return;
  }

  console.log(
    `${targets.length} of ${runs.length} runs are Hermes background-review turns:\n`,
  );
  for (const run of targets) {
    const assistant = run.messages.find((m) => m.role === "assistant");
    console.log(`  ${run.id}  ${run.startedAt.toISOString()}  ${run.source}  ${run.customer.email}`);
    console.log(`    title : ${JSON.stringify(run.title)}`);
    console.log(`    reply : ${JSON.stringify((assistant?.content ?? "").slice(0, 120))}`);
    console.log(`    (${run.messages.length} message(s) cascade with it)`);
  }

  if (!apply) {
    console.log(`\nDry run - nothing deleted. Re-run with --apply to delete these ${targets.length} run(s).`);
    return;
  }

  const { count } = await prisma.run.deleteMany({
    where: { id: { in: targets.map((r) => r.id) } },
  });
  console.log(`\nDeleted ${count} run(s).`);

  // Proven by query rather than asserted: this repo has twice recorded a
  // cleanup that had not actually happened.
  const remaining = await prisma.run.findMany({
    where: { id: { in: targets.map((r) => r.id) } },
    select: { id: true },
  });
  const orphanMessages = await prisma.runMessage.count({
    where: { runId: { in: targets.map((r) => r.id) } },
  });
  console.log(
    `Verified: ${remaining.length} target run(s) remain, ${orphanMessages} orphaned message(s).`,
  );
  if (remaining.length > 0 || orphanMessages > 0) process.exitCode = 1;
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
