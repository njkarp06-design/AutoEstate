import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { authenticateIngestRequest } from "@/lib/ingest-auth";
import { replyDefersToOperator } from "@/lib/inquiries";
import { notifyOperatorOfLead } from "@/lib/notify-operator";

// Inbound counterpart to /api/ingest. Same server-to-server bearer auth
// (authenticateIngestRequest resolves the Customer), same discriminated-union
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
  const authResult = await authenticateIngestRequest(request);
  if (!authResult.ok) {
    return NextResponse.json(
      { ok: false, error: authResult.error },
      { status: authResult.status },
    );
  }
  const customer = authResult.customer;

  const parsed = bodySchema.safeParse(await request.json());
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
      // Coalesce buyerContact: fill it once we learn it, never overwrite a
      // captured value with a later null.
      update: { buyerContact: body.buyerContact ?? undefined },
    });
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
    update: { buyerContact: body.buyerContact ?? undefined },
  });

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
    await maybeLinkListing(customer.id, inquiry.id, `${body.userMessage}\n${body.assistantResponse}`);
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

// Conservative, best-effort: link the inquiry to a listing only when exactly
// one of the customer's listing areas appears in the turn text. The buyer
// skill emits no Listing Record footer (it only reads), so unlike /api/ingest
// there's no structured marker to parse - this is a soft area-mention match,
// deliberately no-op unless it's unambiguous. Never overwrites an existing
// link (once pinned, it stays).
async function maybeLinkListing(
  customerId: string,
  inquiryId: string,
  text: string,
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
  // are stored as "Rothschild Boulevard, Tel Aviv" (the skills' footer format),
  // but nobody types the city: a buyer writes "the Rothschild place" and the
  // bot replies "Rothschild Boulevard". Requiring the full string meant this
  // never fired for realistic phrasing - confirmed on the first real buyer
  // thread, which was unmistakably about Rothschild and still linked to null.
  // Still conservative: a single distinct match is required, so a turn naming
  // two areas links nothing.
  const haystack = text.toLowerCase();
  const matched = listings.filter((l) => {
    const needle = l.area.split(",")[0].trim().toLowerCase();
    return needle.length > 0 && haystack.includes(needle);
  });
  const distinctIds = new Set(matched.map((l) => l.id));
  if (distinctIds.size !== 1) return;

  await prisma.inquiry.update({
    where: { id: inquiryId },
    data: { listingId: matched[0].id },
  });
}
