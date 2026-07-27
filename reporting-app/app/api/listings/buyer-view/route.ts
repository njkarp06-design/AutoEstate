import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateMachineRequest } from "@/lib/ingest-auth";

// Called by a customer's own buyer-facing Hermes instance
// (agent/plugins/buyer-listings-context) so the buyer-inquiry skill can answer
// a stranger's questions from real data. Deliberately the mirror image of
// /api/listings/active: that one returns ACTIVE only (the operator's outbound
// skills only act on live listings), whereas the buyer bot MUST know about
// SOLD/UNDER_CONTRACT rows too so it can tell a buyer honestly that a listing
// is already gone rather than call it available. So this returns every status
// and includes the `status` field, which `active` omits.
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
      area: l.area,
      transactionType: l.transactionType,
      rooms: l.rooms,
      sqm: l.sqm,
      floor: l.floor,
      price: l.price,
      status: l.status,
    })),
  });
}
