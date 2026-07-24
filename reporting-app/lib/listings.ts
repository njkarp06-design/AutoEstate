import { prisma } from "@/lib/prisma";
import type { Customer } from "@/prisma/generated/prisma/client";

// DB-facing status value, kept as an inline literal union rather than an
// import of Prisma's generated `ListingStatus` type - same decoupling
// convention as lib/db.ts's DbPlatform/RunStatus handling.
type DbListingStatus = "ACTIVE" | "UNDER_CONTRACT" | "SOLD";

export type ListingStatus = "active" | "under_contract" | "sold";

function toListingStatus(status: DbListingStatus): ListingStatus {
  if (status === "ACTIVE") return "active";
  if (status === "UNDER_CONTRACT") return "under_contract";
  return "sold";
}

export type Listing = {
  id: string;
  area: string;
  transactionType: string;
  rooms: number;
  sqm: number;
  floor: number | null;
  price: number | null;
  status: ListingStatus;
  updatedAt: number; // epoch seconds - same convention as lib/db.ts's Run
  // The Run whose generated posts (Instagram/Facebook/Yad2) this listing
  // came from, most-recent first - lets the UI link out to /runs/[id].
  // Null when no Run points at this listing: Run.listingId is left null for
  // a turn that mixed two distinguishable listings (see the Run model
  // comment and app/api/ingest/route.ts) - both Listing rows are still
  // created/updated correctly, they just have no single Run to link back to.
  latestRunId: string | null;
};

/**
 * Every listing ever advertised through Hermes for this customer, regardless
 * of status - unlike /api/listings/active (ACTIVE only, for the digest),
 * this read-only view intentionally shows everything so an auto-matching
 * mistake at ingest time (see app/api/ingest/route.ts) stays visible rather
 * than silently hidden. No mutation helpers: there is no edit UI for
 * listings in this pass (see the schema comment on the Listing model).
 */
export async function getListings(customer: Customer): Promise<Listing[]> {
  const listings = await prisma.listing.findMany({
    where: { customerId: customer.id },
    orderBy: { updatedAt: "desc" },
    include: {
      runs: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { id: true },
      },
    },
  });

  return listings.map((l) => ({
    id: l.id,
    area: l.area,
    transactionType: l.transactionType,
    rooms: l.rooms,
    sqm: l.sqm,
    floor: l.floor,
    price: l.price,
    status: toListingStatus(l.status),
    updatedAt: Math.floor(l.updatedAt.getTime() / 1000),
    latestRunId: l.runs[0]?.id ?? null,
  }));
}
