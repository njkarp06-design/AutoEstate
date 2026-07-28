import { getListings } from "@/lib/listings";
import { getCurrentCustomer } from "@/lib/customer";
import { ListingList } from "./listing-list";

// Always read the live database - never serve a stale build-time snapshot.
export const dynamic = "force-dynamic";

export default async function ListingsPage() {
  const customer = await getCurrentCustomer();

  if (!customer) {
    return (
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
        <h1 className="font-display text-2xl font-semibold italic tracking-tight">
          Listings
        </h1>
        <div className="mt-8 border border-dashed border-card-border px-6 py-12 text-center">
          <p className="font-display italic">Your account isn&apos;t linked yet</p>
          <p className="mt-1 text-sm text-status-muted">
            Contact your AutoEstate operator to get your account set up.
          </p>
        </div>
      </main>
    );
  }

  const listings = await getListings(customer);

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
      <ListingList
        listings={listings}
        buyerWhatsappNumber={customer.buyerWhatsappNumber}
      />
    </main>
  );
}
