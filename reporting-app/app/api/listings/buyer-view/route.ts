import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateMachineRequest } from "@/lib/ingest-auth";

// Called by a customer's own buyer-facing Hermes instance
// (agent/plugins/buyer-listings-context) so the buyer-inquiry skill can answer
// a stranger's questions from real data. Deliberately the mirror image of
// /api/listings/active: that one returns every NON-SOLD listing (ACTIVE and
// UNDER_CONTRACT - widened 2026-07-31, it was ACTIVE-only before), because the
// operator's outbound skills only act on a listing still in play. The buyer
// bot MUST additionally know about SOLD rows, so it can tell a buyer honestly
// that a listing is already gone rather than quietly omit it. So this returns
// every status. Both endpoints now carry a `status` field; the difference is
// which rows they include, not what they describe.
export async function GET(request: NextRequest) {
  // BUYER role only, and read-only - the public instance never needs more than
  // this from the listings table.
  const authResult = await authenticateMachineRequest(request, "buyer");
  if (!authResult.ok) {
    return NextResponse.json(
      { ok: false, error: authResult.error },
      { status: authResult.status },
    );
  }

  const listings = await prisma.listing.findMany({
    where: { customerId: authResult.customer.id },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json({
    ok: true,
    listings: listings.map((l) => ({
      // The public code from the buyer's ad link. Exposed HERE and not on
      // /api/listings/active: it exists so the buyer bot can resolve a
      // property from message one instead of guessing, and the outbound
      // skills have no use for it. Null on rows that predate the column.
      refCode: l.refCode,
      area: l.area,
      transactionType: l.transactionType,
      rooms: l.rooms,
      sqm: l.sqm,
      floor: l.floor,
      price: l.price,
      status: l.status,
      // Amenities the agent stated. Exposed HERE and not on /api/listings/active:
      // this is what lets the buyer bot answer "is there parking?" instead of
      // deferring. Not exhaustive - see the buyer-inquiry skill's rule that an
      // absent feature is unknown, never absent.
      features: l.features,
    })),
  });
}
