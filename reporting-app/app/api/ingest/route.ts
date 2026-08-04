import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { authenticateMachineRequest } from "@/lib/ingest-auth";
import { parseListingRecords, hasListingRecordHeader } from "@/lib/listing-record";
import { generateRefCode } from "@/lib/ref-code";
import { isBackgroundReviewTurn } from "@/lib/hermes-harness";
import { withWriteConflictRetry } from "@/lib/write-conflict-retry";

// Prisma compiles `equals` + mode: "insensitive" to ILIKE (verified by
// capturing the emitted SQL, 2026-08-04), where % and _ are live wildcards -
// so an unescaped area value would make this match a PATTERN while the partial
// unique index compares lower(area) exactly. Escaping keeps the two keys the
// same function, which is the property the index's own migration comment
// claims. Storage always uses the raw (unescaped) value.
function escapeIlike(value: string): string {
  return value.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

// A media-only message (photo/sticker with no caption) reaches the sync plugin
// with an empty user_message - the adapter sets body = "" and native image
// routing adds no text. Rejecting it with the old min(1) schema meant the
// whole turn was dropped permanently (the plugin deliberately never retries a
// 4xx), losing the reply and any Listing Record footer with it. Accept it and
// store a placeholder instead, so the transcript stays legible.
const MEDIA_ONLY_PLACEHOLDER = "[media-only message]";

/**
 * A ref code that no listing currently holds.
 *
 * Runs inside the caller's Serializable transaction, so the check-then-use is
 * not racy the way it would be at READ COMMITTED, and the column's unique
 * constraint is the backstop if it ever were. Retries because the alphabet is
 * deliberately small and human-readable rather than collision-proof by size.
 *
 * Returns null rather than throwing when it can't find a free code: a listing
 * with no code is a listing you can't deep-link to, which is a degraded
 * feature. Failing here instead would abort the transaction and lose the
 * Listing row entirely, which is a lost listing - strictly worse, and the
 * exact silent-untracked-listing failure this file has produced twice before.
 */
async function allocateRefCode(
  tx: { listing: { findUnique: (a: { where: { refCode: string } }) => Promise<unknown> } },
): Promise<string | null> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = generateRefCode();
    if (!(await tx.listing.findUnique({ where: { refCode: code } }))) return code;
  }
  console.error("ingest: could not allocate a unique listing refCode after 8 attempts");
  return null;
}

const turnStartedSchema = z.object({
  event: z.literal("turn_started"),
  sessionId: z.string().min(1),
  turnId: z.string().min(1),
  platform: z.enum(["whatsapp", "whatsapp_cloud", "telegram"]),
  userMessage: z.string().nullish(),
  occurredAt: z.string().datetime(),
});

const turnCompletedSchema = z.object({
  event: z.literal("turn_completed"),
  sessionId: z.string().min(1),
  turnId: z.string().min(1),
  platform: z.enum(["whatsapp", "whatsapp_cloud", "telegram"]),
  // Empty is legal - a media-only message. See MEDIA_ONLY_PLACEHOLDER above.
  userMessage: z.string(),
  assistantResponse: z.string().min(1),
  occurredAt: z.string().datetime(),
});

const bodySchema = z.discriminatedUnion("event", [
  turnStartedSchema,
  turnCompletedSchema,
]);

function deriveTitle(userMessage: string): string {
  return userMessage.split("\n")[0].slice(0, 60);
}

export async function POST(request: NextRequest) {
  // OPERATOR role only. This route writes Run rows and creates/transitions
  // Listing rows, so the buyer instance's secret must never reach it - that
  // exposure is the reason the credential was split in two.
  const authResult = await authenticateMachineRequest(request, "operator");
  if (!authResult.ok) {
    return NextResponse.json(
      { ok: false, error: authResult.error },
      { status: authResult.status },
    );
  }
  const customer = authResult.customer;

  // Guarded: an unparseable body would otherwise throw before Zod ever runs,
  // turning a client-side mistake into a 500 instead of the 400 the
  // validation path below is written to return.
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid JSON body" },
      { status: 400 },
    );
  }

  const parsed = bodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.message },
      { status: 400 },
    );
  }
  const body = parsed.data;

  // Hermes's own background-review housekeeping turn, not customer activity -
  // see lib/hermes-harness.ts for what it is and why it reaches us at all.
  // Acknowledged with a 200 rather than rejected: the sync plugin logs a
  // warning on any >=400 (and correctly does not retry it), and this is not an
  // error - it is the route working as intended. Checked before any write, so
  // neither event ever creates a row.
  if (isBackgroundReviewTurn(body.userMessage)) {
    return NextResponse.json({ ok: true, skipped: "background_review" });
  }

  const startedAt = new Date(body.occurredAt);

  // Grouping key is the turn, not the session: Hermes doesn't reset a
  // WhatsApp/Telegram session between messages, so a session can span many
  // unrelated listings sent back-to-back. One turn = one Run.
  if (body.event === "turn_started") {
    const run = await prisma.run.upsert({
      where: {
        customerId_hermesTurnId: {
          customerId: customer.id,
          hermesTurnId: body.turnId,
        },
      },
      create: {
        customerId: customer.id,
        hermesSessionId: body.sessionId,
        hermesTurnId: body.turnId,
        source: body.platform,
        startedAt,
        status: "IN_PROGRESS",
        title: body.userMessage ? deriveTitle(body.userMessage) : null,
      },
      update: {},
    });
    return NextResponse.json({ ok: true, runId: run.id });
  }

  // turn_completed
  const userMessageText = body.userMessage || MEDIA_ONLY_PLACEHOLDER;

  const run = await prisma.run.upsert({
    where: {
      customerId_hermesTurnId: {
        customerId: customer.id,
        hermesTurnId: body.turnId,
      },
    },
    create: {
      customerId: customer.id,
      hermesSessionId: body.sessionId,
      hermesTurnId: body.turnId,
      source: body.platform,
      startedAt,
      status: "COMPLETED",
      title: deriveTitle(userMessageText),
    },
    update: {
      status: "COMPLETED",
    },
  });

  if (!run.title) {
    await prisma.run.update({
      where: { id: run.id },
      data: { title: deriveTitle(userMessageText) },
    });
  }

  await prisma.runMessage.createMany({
    data: [
      {
        runId: run.id,
        role: "user",
        content: userMessageText,
        timestamp: startedAt,
        sortIndex: 0,
      },
      {
        runId: run.id,
        role: "assistant",
        content: body.assistantResponse,
        // Never earlier than the user row it answers. startedAt is stamped by
        // the HERMES box's clock and this row by the app server's; display
        // orders by timestamp first, so a Hermes clock ahead of ours by more
        // than the request latency would render the reply ABOVE its question.
        // Clamping at write time fixes ordering without touching read paths.
        timestamp: new Date(Math.max(Date.now(), startedAt.getTime() + 1)),
        sortIndex: 1,
      },
    ],
    skipDuplicates: true,
  });

  // Best-effort Listing tracking, parsed from the "Listing Record" footer
  // listing-to-social, listing-status-update and just-sold append. Wrapped so a
  // parse/match failure can never fail the request or lose the Run/messages
  // already recorded above - this is purely additive bookkeeping.
  try {
    const records = parseListingRecords(body.assistantResponse);
    // The one diagnostic this pipeline was missing: a reply that CONTAINS a
    // Listing Record header but parses to zero records previously produced no
    // log line anywhere - the silent-untracked-listing shape again, e.g. a
    // model writing "Status: Available" (unrecognized) drops the whole record.
    if (records.length === 0 && hasListingRecordHeader(body.assistantResponse)) {
      console.error(
        "ingest: reply contains a Listing Record header but no record parsed - listing NOT tracked (run %s). Check the footer's required lines (Area/Rooms/Size/Status).",
        run.id,
      );
    }
    const listingIds: string[] = [];

    for (const record of records) {
      const roomsKey = Math.round(record.rooms * 10) / 10;
      const sqmKey = Math.round(record.sqm * 10) / 10;

      // Serializable, because this is a read-then-write with no unique
      // constraint behind it. Two turns for the same property arriving close
      // together - which the documented busy_input_mode: interrupt merge quirk
      // makes a real scenario, not a theoretical one - could both miss the
      // findFirst and both create, leaving duplicate Listing rows that no UI
      // can merge or delete.
      //
      // The database-level guarantee LANDED 2026-07-31: migration
      // 20260731_listing_partial_unique_index creates
      //   UNIQUE (customerId, lower(area), rooms, sqm) WHERE status <> 'SOLD'
      // A partial *expression* index specifically, because this lookup is
      // case-insensitive AND excludes SOLD on purpose - so a sold row plus a
      // relisted active row for the same property is two rows by design, and
      // the obvious @@unique([customerId, area, rooms, sqm]) would wrongly
      // block a legitimate relist. Prisma cannot express either the predicate
      // or the lower(), so it is raw SQL and invisible to schema.prisma.
      //
      // Wrapped in withWriteConflictRetry because Prisma does not retry an
      // interactive transaction. It covers BOTH ways a lost race surfaces:
      // P2034 (Serializable abort) and - now that the index exists - P2002,
      // which is the more likely one, since the second inserter blocks on the
      // index and gets a duplicate-key error once the first commits. On retry
      // the findFirst below sees the committed row and updates it. Unretried,
      // either code would be swallowed by this block's catch and the listing
      // silently never tracked - see lib/write-conflict-retry.ts.
      const listing = await withWriteConflictRetry(() => prisma.$transaction(
        async (tx) => {
          const areaMatch = { equals: escapeIlike(record.area.trim()), mode: "insensitive" as const };
          const existing = await tx.listing.findFirst({
            where: {
              customerId: customer.id,
              area: areaMatch,
              rooms: roomsKey,
              sqm: sqmKey,
              NOT: { status: "SOLD" },
            },
          });

          const applyUpdate = (target: { id: string; transactionType: string; floor: number | null; price: number | null; features: string | null }) =>
            tx.listing.update({
              where: { id: target.id },
              data: {
                status: record.status,
                transactionType: record.transactionType || target.transactionType,
                floor: record.floor ?? target.floor,
                price: record.price ?? target.price,
                // ?? not =, same as floor/price: a just-sold or status-change
                // footer need not restate features, and must never wipe them.
                features: record.features ?? target.features,
              },
            });

          if (existing) return applyUpdate(existing);

          // A SOLD record with no non-SOLD match: before creating, look for an
          // existing SOLD row with the same identity and update THAT in place.
          // Without this, re-announcing a sale ("redo that sold post") minted a
          // duplicate SOLD row with a fresh refCode on every regeneration -
          // invisible to the partial unique index, which deliberately excludes
          // SOLD so a genuine relist-then-sell-again can produce two rows. The
          // legitimate double-sale still works: the relist creates an ACTIVE
          // row, which the non-SOLD match above catches first. This fallback is
          // also what makes the write-conflict retry sound for SOLD footers -
          // the re-run now finds the committed row instead of re-creating it.
          if (record.status === "SOLD") {
            const priorSold = await tx.listing.findFirst({
              where: {
                customerId: customer.id,
                area: areaMatch,
                rooms: roomsKey,
                sqm: sqmKey,
                status: "SOLD",
              },
              orderBy: { updatedAt: "desc" },
            });
            if (priorSold) return applyUpdate(priorSold);
          }

          return tx.listing.create({
            data: {
              customerId: customer.id,
              area: record.area.trim(),
              transactionType: record.transactionType,
              rooms: roomsKey,
              sqm: sqmKey,
              floor: record.floor,
              price: record.price,
              status: record.status,
              features: record.features,
              // Only ever set on CREATE. A code that has been printed in a
              // live ad must keep resolving to the same property for as long
              // as that ad exists, so the update branch above deliberately
              // leaves it alone - reissuing one would silently break every
              // buyer who taps an older link.
              refCode: await allocateRefCode(tx),
            },
          });
        },
        { isolationLevel: "Serializable" },
      ));

      listingIds.push(listing.id);
    }

    // A single nullable FK on Run can't represent "this turn touched two
    // listings" (see listing-to-social's mixed-input handling) - only link
    // when exactly one record was parsed. Both Listing rows are still
    // correctly created/updated above regardless; only the Run's own
    // backlink is left null in the rare two-listing case.
    if (listingIds.length === 1) {
      await prisma.run.update({
        where: { id: run.id },
        data: { listingId: listingIds[0] },
      });
    }
  } catch (err) {
    console.error("ingest: listing-record linking failed", err);
  }

  return NextResponse.json({ ok: true, runId: run.id });
}
