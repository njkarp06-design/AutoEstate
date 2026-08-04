import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateMachineRequest } from "@/lib/ingest-auth";

// Called by a customer's own Hermes instance (agent/plugins/active-listings-context)
// to fetch the listings a reply may draw on: weekly-digest's roundup, and the
// locator lookup in listing-reengagement / listing-status-update / just-sold.
//
// RETURNS EVERY NON-SOLD LISTING, WITH ITS STATUS - widened 2026-07-31, having
// previously been ACTIVE-only. The path name is now slightly narrow and is
// kept anyway: renaming it would require the route and every profile's copy of
// the plugin to deploy in lockstep, and a plugin pointed at a 404 injects no
// context at all - which for weekly-digest is a WRONG ANSWER ("no active
// listings" while several exist), not a soft fallback.
//
// WHY: /api/listings/active being ACTIVE-only made an UNDER_CONTRACT listing
// invisible to the locator lookup, so the canonical lifecycle - "the Dizengoff
// place is under contract", then weeks later "the Dizengoff place sold" - had
// the agent told its own listing was not on record, and asked to retype the
// facts the locator feature exists to avoid. Data was never at risk (ingest's
// match excludes only SOLD, so restated facts still transition the right row);
// the cost was a false statement plus the friction.
//
// SOLD is still excluded, deliberately. A sold property is not actionable by
// any of the four consuming skills, and ingest's own match key excludes SOLD
// too, so including it here would let a locator resolve to a row that a
// subsequent footer would not update. The buyer-facing /api/listings/buyer-view
// DOES return every status, because a buyer asking about a sold property must
// be told the truth rather than have it hidden - a different question.
//
// The consuming skills are NOT all allowed the same rows, and the plugin tags
// each one so they can tell: weekly-digest and listing-reengagement must use
// ACTIVE only (a roundup of "what's on the market" must not advertise a
// property under contract, and you do not re-promote one either), while
// listing-status-update and just-sold may match either. That split lives in
// each SKILL.md; this endpoint just reports the truth.
export async function GET(request: NextRequest) {
  // OPERATOR role only - this is the operator instance's digest/locator feed.
  // The buyer instance reads /api/listings/buyer-view instead, which returns
  // every status so the bot can be honest about a property being gone.
  const authResult = await authenticateMachineRequest(request, "operator");
  if (!authResult.ok) {
    return NextResponse.json(
      { ok: false, error: authResult.error },
      { status: authResult.status },
    );
  }

  const listings = await prisma.listing.findMany({
    where: { customerId: authResult.customer.id, NOT: { status: "SOLD" } },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json({
    ok: true,
    listings: listings.map((l) => ({
      area: l.area,
      transactionType: l.transactionType,
      rooms: l.rooms,
      sqm: l.sqm,
      floor: l.floor,
      price: l.price,
      // Added 2026-07-31 with the widening above. The plugin's handling is
      // deliberately asymmetric, and an earlier version of this comment
      // described it BACKWARDS: a row with the key ABSENT renders as ACTIVE
      // (absent can only mean the pre-widening route, which returned ACTIVE
      // rows exclusively - treating it as unavailable would blank the digest
      // during a plugin-ahead-of-app deploy window), while a PRESENT but
      // unrecognised value renders unavailable (under-advertising is the
      // harmless direction for a value we genuinely can't interpret). See
      // _status_tag in agent/plugins/active-listings-context/__init__.py.
      status: l.status,
    })),
  });
}
