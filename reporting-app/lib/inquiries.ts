import { prisma } from "@/lib/prisma";
import type { Customer } from "@/prisma/generated/prisma/client";

// DB-facing status value, kept as an inline literal union rather than an
// import of Prisma's generated `InquiryStatus` type - same decoupling
// convention as lib/db.ts and lib/listings.ts.
type DbInquiryStatus = "NEEDS_OPERATOR" | "HANDLED";

export type InquiryStatus = "needs_operator" | "handled";

// Two DIFFERENT axes, deliberately not merged:
//  - `status` (stored, operator-controlled): has the operator dealt with this
//    lead yet? NEEDS_OPERATOR -> HANDLED via the dashboard.
//  - `disposition` (computed here, display-only, never stored): did the bot's
//    latest reply hand off to a human, or fully answer it itself? Keyed off
//    the buyer-inquiry skill's CANONICAL DEFER SENTENCE - see
//    replyDefersToOperator below. This is the plan's "display-only heuristic",
//    never a safety boundary.
export type InquiryDisposition = "auto_answered" | "needs_you";

function toInquiryStatus(status: DbInquiryStatus): InquiryStatus {
  return status === "HANDLED" ? "handled" : "needs_operator";
}

// Stable fragments of the buyer-inquiry skill's canonical defer sentence, in
// each language. Matched as substrings rather than the whole sentence so a
// stray punctuation/quote difference can't silently drop a real defer. This is
// a REAL COUPLING with agent/skills/real-estate/buyer-inquiry/SKILL.md's
// "Deferring" section - if the canonical sentence there changes, change these.
const DEFER_FRAGMENTS = [
  "passed your details along to the agent", // English
  "העברתי את הפרטים שלך לסוכן", // Hebrew
];

/**
 * Does this assistant reply hand the buyer off to the human agent? Display
 * heuristic only (drives the "needs you" disposition + the operator
 * notification) - never a safety/authorization decision.
 */
export function replyDefersToOperator(text: string): boolean {
  return DEFER_FRAGMENTS.some((f) => text.includes(f));
}

export type Inquiry = {
  id: string;
  source: string;
  buyerContact: string | null;
  status: InquiryStatus;
  disposition: InquiryDisposition;
  title: string | null;
  startedAt: number; // epoch seconds - same convention as lib/db.ts's Run
};

export type InquiryMessage = {
  role: string;
  content: string;
  timestamp: number;
};

export type InquiryDetail = Inquiry & {
  messages: InquiryMessage[];
  listing: {
    id: string;
    area: string;
    transactionType: string;
    rooms: number;
    sqm: number;
    floor: number | null;
    price: number | null;
    status: "ACTIVE" | "UNDER_CONTRACT" | "SOLD";
  } | null;
};

function toEpochSeconds(date: Date): number {
  return Math.floor(date.getTime() / 1000);
}

// Disposition = did the LATEST assistant message defer? An inquiry with no
// assistant reply yet (only a buyer question recorded) is treated as
// auto-answered - nothing to flag until the bot actually hands off.
function computeDisposition(
  messages: { role: string; content: string }[],
): InquiryDisposition {
  // ANY deferring reply in the thread marks it "needs you", not just the
  // latest one. Keying on the latest reply was wrong in a way the first real
  // buyer thread exposed immediately: the buyer asked about a sold listing,
  // asked for a missing fact, and asked for a viewing - three separate turns
  // that each deferred with the canonical sentence - then sent one more
  // message the bot answered itself. The last reply had no defer sentence, so
  // a lead that had explicitly asked for a viewing displayed as
  // "auto-answered", i.e. exactly the lead the operator most needs to see,
  // hidden. Once a thread has handed off, it needs the human until the
  // operator marks it HANDLED - which is what the separate stored `status`
  // axis is for.
  if (messages.some((m) => m.role === "assistant" && replyDefersToOperator(m.content))) {
    return "needs_you";
  }
  return "auto_answered";
}

/**
 * Every buyer inquiry for this customer, newest first. Scoped by customerId -
 * a customer only ever sees their own buyer's leads. Disposition is computed
 * per-inquiry from its latest assistant message (see computeDisposition).
 */
export async function getInquiries(customer: Customer): Promise<Inquiry[]> {
  const inquiries = await prisma.inquiry.findMany({
    where: { customerId: customer.id },
    orderBy: { startedAt: "desc" },
    include: {
      messages: { orderBy: [{ timestamp: "asc" }, { sortIndex: "asc" }] },
    },
  });

  return inquiries.map((inq) => ({
    id: inq.id,
    source: inq.source,
    buyerContact: inq.buyerContact,
    status: toInquiryStatus(inq.status),
    disposition: computeDisposition(inq.messages),
    title: inq.title,
    startedAt: toEpochSeconds(inq.startedAt),
  }));
}

/**
 * A single inquiry's full thread for this customer - null if not found or not
 * owned by them (ownership-checked, same pattern as lib/db.ts's getRun).
 */
export async function getInquiry(
  id: string,
  customer: Customer,
): Promise<InquiryDetail | null> {
  const inquiry = await prisma.inquiry.findFirst({
    where: { id, customerId: customer.id },
    include: {
      messages: { orderBy: [{ timestamp: "asc" }, { sortIndex: "asc" }] },
      listing: true,
    },
  });
  if (!inquiry) return null;

  const messages = inquiry.messages.map((m) => ({
    role: m.role,
    content: m.content,
    timestamp: toEpochSeconds(m.timestamp),
  }));

  return {
    id: inquiry.id,
    source: inquiry.source,
    buyerContact: inquiry.buyerContact,
    status: toInquiryStatus(inquiry.status),
    disposition: computeDisposition(messages),
    title: inquiry.title,
    startedAt: toEpochSeconds(inquiry.startedAt),
    messages,
    listing: inquiry.listing
      ? {
          id: inquiry.listing.id,
          area: inquiry.listing.area,
          transactionType: inquiry.listing.transactionType,
          rooms: inquiry.listing.rooms,
          sqm: inquiry.listing.sqm,
          floor: inquiry.listing.floor,
          price: inquiry.listing.price,
          status: inquiry.listing.status,
        }
      : null,
  };
}

/**
 * Ownership-checked: marks an inquiry HANDLED (or back to NEEDS_OPERATOR).
 * Re-derives the owning inquiry from (id, customer) and no-ops if it isn't
 * found or isn't owned by this customer - same DAL pattern as lib/db.ts's
 * per-run mutation helpers.
 */
export async function setInquiryHandled(
  id: string,
  customer: Customer,
  handled: boolean,
): Promise<void> {
  const inquiry = await prisma.inquiry.findFirst({
    where: { id, customerId: customer.id },
  });
  if (!inquiry) return;

  await prisma.inquiry.update({
    where: { id: inquiry.id },
    data: { status: handled ? "HANDLED" : "NEEDS_OPERATOR" },
  });
}
