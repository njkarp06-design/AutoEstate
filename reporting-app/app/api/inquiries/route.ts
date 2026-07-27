import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { authenticateMachineRequest } from "@/lib/ingest-auth";
import { replyDefersToOperator } from "@/lib/inquiries";
import { notifyOperatorOfLead } from "@/lib/notify-operator";

// Inbound counterpart to /api/ingest. Same server-to-server bearer auth
// (authenticateMachineRequest resolves the Customer, scoped to the BUYER
// role — a different credential from /api/ingest's), same discriminated-union
// turn_started/turn_completed shape - but keyed on the SESSION (one Inquiry
// per buyer conversation), not the turn, and carrying two buyer-only optional
// fields the sync-inquiries-to-webapp plugin resolves best-effort:
//   - sender:       an opaque stable handle for the buyer (reference only).
//   - buyerContact: the best human-reachable contact (phone/name) - THE #1
//                   lead field; null when nothing reachable was captured.

const turnStartedSchema = z.object({
  event: z.literal("turn_started"),
  sessionId: z.string().min(1),
  turnId: z.string().min(1),
  platform: z.enum(["whatsapp", "telegram"]),
  userMessage: z.string().nullish(),
  sender: z.string().nullish(),
  buyerContact: z.string().nullish(),
  occurredAt: z.string().datetime(),
});

const turnCompletedSchema = z.object({
  event: z.literal("turn_completed"),
  sessionId: z.string().min(1),
  turnId: z.string().min(1),
  platform: z.enum(["whatsapp", "telegram"]),
  userMessage: z.string().min(1),
  assistantResponse: z.string().min(1),
  sender: z.string().nullish(),
  buyerContact: z.string().nullish(),
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
  // BUYER role only. Writes are confined to this customer's Inquiry and
  // InquiryMessage rows (plus a listingId backlink); it never mutates a
  // Listing, which is what makes it safe for the public instance to hold this
  // credential.
  const authResult = await authenticateMachineRequest(request, "buyer");
  if (!authResult.ok) {
    return NextResponse.json(
      { ok: false, error: authResult.error },
      { status: authResult.status },
    );
  }
  const customer = authResult.customer;

  // Guarded: an unparseable body would otherwise throw before Zod ever runs,
  // turning a client-side mistake into a 500 instead of a 400.
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

  if (body.event === "turn_started") {
    const inquiry = await prisma.inquiry.upsert({
      where: {
        customerId_hermesSessionId: {
          customerId: customer.id,
          hermesSessionId: body.sessionId,
        },
      },
      create: {
        customerId: customer.id,
        hermesSessionId: body.sessionId,
        source: body.platform,
        startedAt,
        title: body.userMessage ? deriveTitle(body.userMessage) : null,
        buyerContact: body.buyerContact ?? null,
      },
      update: {},
    });
    await fillBuyerContactIfEmpty(inquiry, body.buyerContact);
    return NextResponse.json({ ok: true, inquiryId: inquiry.id });
  }

  // turn_completed
  const inquiry = await prisma.inquiry.upsert({
    where: {
      customerId_hermesSessionId: {
        customerId: customer.id,
        hermesSessionId: body.sessionId,
      },
    },
    create: {
      customerId: customer.id,
      hermesSessionId: body.sessionId,
      source: body.platform,
      startedAt,
      title: deriveTitle(body.userMessage),
      buyerContact: body.buyerContact ?? null,
    },
    update: {},
  });
  await fillBuyerContactIfEmpty(inquiry, body.buyerContact);

  if (!inquiry.title) {
    await prisma.inquiry.update({
      where: { id: inquiry.id },
      data: { title: deriveTitle(body.userMessage) },
    });
  }

  // Dedup on the turn: a retried sync POST for the same turn can't double the
  // thread. sortIndex is display order only (user before assistant).
  await prisma.inquiryMessage.createMany({
    data: [
      {
        inquiryId: inquiry.id,
        hermesTurnId: body.turnId,
        role: "user",
        content: body.userMessage,
        timestamp: startedAt,
        sortIndex: 0,
      },
      {
        inquiryId: inquiry.id,
        hermesTurnId: body.turnId,
        role: "assistant",
        content: body.assistantResponse,
        timestamp: new Date(),
        sortIndex: 1,
      },
    ],
    skipDuplicates: true,
  });

  // Best-effort side work - never fail the request (the thread + messages are
  // already recorded above). Two additive things:
  //  1. Link the inquiry to a listing when the conversation unambiguously
  //     concerns exactly one of the customer's listings (matched by area
  //     mentioned). Conservative: only a single distinct area match links.
  //  2. If this reply hands off to a human, notify the operator with the
  //     buyer's contact attached (the #1-value lead moment).
  try {
    await maybeLinkListing(customer.id, inquiry.id, body.userMessage);
  } catch (err) {
    console.error("inquiries: listing linking failed", err);
  }

  if (replyDefersToOperator(body.assistantResponse)) {
    try {
      await notifyOperatorOfLead({
        customer,
        inquiryId: inquiry.id,
        buyerContact: inquiry.buyerContact ?? body.buyerContact ?? null,
        title: inquiry.title ?? deriveTitle(body.userMessage),
        source: body.platform,
        latestBuyerMessage: body.userMessage,
      });
    } catch (err) {
      console.error("inquiries: operator notification failed", err);
    }
  }

  return NextResponse.json({ ok: true, inquiryId: inquiry.id });
}

/**
 * Writes buyerContact ONLY when the thread has none yet, then keeps the
 * in-memory row in step so later reads (the operator notification) see it.
 *
 * This used to be `update: { buyerContact: body.buyerContact ?? undefined }`
 * on the upsert, whose comment claimed it would "never overwrite a captured
 * value". It only guarded against a later *null* - a later non-null replaced a
 * real captured number unconditionally. That matters because the contact is
 * re-extracted from the message text on every single turn (see the sync
 * plugin's _extract_phone), so any later turn producing a different match
 * silently overwrote the number the buyer actually gave. First value wins:
 * a buyer who types their number once has given it, and nothing later in the
 * conversation is more authoritative than that.
 */
async function fillBuyerContactIfEmpty(
  inquiry: { id: string; buyerContact: string | null },
  incoming: string | null | undefined,
): Promise<void> {
  if (inquiry.buyerContact || !incoming) return;

  await prisma.inquiry.update({
    where: { id: inquiry.id },
    data: { buyerContact: incoming },
  });
  inquiry.buyerContact = incoming;
}

// Conservative, best-effort: link the inquiry to a listing only when exactly
// one of the customer's listing areas is named by the BUYER. The buyer skill
// emits no Listing Record footer (it only reads), so unlike /api/ingest
// there's no structured marker to parse - this is a soft area-mention match,
// deliberately no-op unless it's unambiguous. Never overwrites an existing
// link (once pinned, it stays).
//
// Matches the buyer's own message only, NOT the bot's reply. Since
// buyer-inquiry v0.2.0 the bot proactively names ACTIVE candidates the buyer
// never mentioned, so including its reply could pin a lead to a property the
// buyer never asked about. Verified against the real dev database: on every
// recorded turn this produces the same link decision as the previous
// combined-text version, because the loose-token rule below recovers the
// realistic phrasings ("the Rothschild place", "how much is the Rothschild
// one?") that a strict full-segment match on the buyer's text alone would
// have dropped - which would have meant zero links on all real data.
async function maybeLinkListing(
  customerId: string,
  inquiryId: string,
  buyerMessage: string,
): Promise<void> {
  const current = await prisma.inquiry.findUnique({
    where: { id: inquiryId },
    select: { listingId: true },
  });
  if (current?.listingId) return;

  const listings = await prisma.listing.findMany({
    where: { customerId },
    select: { id: true, area: true },
  });
  // Match on the area's leading segment, not the whole stored string. Areas
  // are stored as "Rothschild Boulevard, Tel Aviv" (the skills' footer format)
  // but nobody types the city, and most don't type the street type either -
  // real buyers wrote "the Rothschild place" and "how much is the Rothschild
  // one?". So also accept the segment's first word, which is what carries the
  // identity. Length-gated at 4 so a short word like "Ben" (of "Ben Gurion")
  // can't match incidental prose; that area still matches on its full segment,
  // as a real buyer's "Is the Ben Gurion apartment still available?" does.
  //
  // Still conservative: exactly one distinct match is required, so a message
  // naming two areas links nothing.
  const haystack = buyerMessage.toLowerCase();
  const matched = listings.filter((l) => {
    const segment = l.area.split(",")[0].trim().toLowerCase();
    if (segment.length === 0) return false;
    if (haystack.includes(segment)) return true;
    const firstWord = segment.split(/\s+/)[0];
    return firstWord.length >= 4 && haystack.includes(firstWord);
  });
  const distinctIds = new Set(matched.map((l) => l.id));
  if (distinctIds.size !== 1) return;

  await prisma.inquiry.update({
    where: { id: inquiryId },
    data: { listingId: matched[0].id },
  });
}
