import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { authenticateMachineRequest } from "@/lib/ingest-auth";
import { parseListingRecords } from "@/lib/listing-record";
import { generateRefCode } from "@/lib/ref-code";

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
  userMessage: z.string().min(1),
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
      title: deriveTitle(body.userMessage),
    },
    update: {
      status: "COMPLETED",
    },
  });

  if (!run.title) {
    await prisma.run.update({
      where: { id: run.id },
      data: { title: deriveTitle(body.userMessage) },
    });
  }

  await prisma.runMessage.createMany({
    data: [
      {
        runId: run.id,
        role: "user",
        content: body.userMessage,
        timestamp: startedAt,
        sortIndex: 0,
      },
      {
        runId: run.id,
        role: "assistant",
        content: body.assistantResponse,
        timestamp: new Date(),
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
      // A unique index would be the stronger fix but the obvious one is WRONG
      // here: this lookup is case-insensitive AND excludes SOLD on purpose, so
      // a sold row plus a relisted active row for the same property is two
      // rows by design. Only a partial expression index
      // (UNIQUE (customerId, lower(area), rooms, sqm) WHERE status <> 'SOLD')
      // matches those semantics; it needs a migration and is tracked in
      // TODO.md as the durable fix before the Vercel deploy.
      const listing = await prisma.$transaction(
        async (tx) => {
          const existing = await tx.listing.findFirst({
            where: {
              customerId: customer.id,
              area: { equals: record.area.trim(), mode: "insensitive" },
              rooms: roomsKey,
              sqm: sqmKey,
              NOT: { status: "SOLD" },
            },
          });

          if (existing) {
            return tx.listing.update({
              where: { id: existing.id },
              data: {
                status: record.status,
                transactionType: record.transactionType || existing.transactionType,
                floor: record.floor ?? existing.floor,
                price: record.price ?? existing.price,
                // ?? not =, same as floor/price: a just-sold or status-change
                // footer need not restate features, and must never wipe them.
                features: record.features ?? existing.features,
              },
            });
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
      );

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
