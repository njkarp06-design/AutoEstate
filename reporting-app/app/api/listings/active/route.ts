import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateMachineRequest } from "@/lib/ingest-auth";

// Called by a customer's own Hermes instance (agent/plugins/active-listings-context)
// to fetch what to include in a weekly-digest reply. Deliberately narrower
// than the reporting-app's own /listings page, which shows every status so
// auto-matching mistakes stay visible - this endpoint only ever returns
// listings genuinely still on the market.
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
    where: { customerId: authResult.customer.id, status: "ACTIVE" },
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
    })),
  });
}
