import { getInquiries } from "@/lib/inquiries";
import { getCurrentCustomer } from "@/lib/customer";
import { InquiryList } from "./inquiry-list";

// Always read the live database - never serve a stale build-time snapshot.
export const dynamic = "force-dynamic";

export default async function InquiriesPage() {
  const customer = await getCurrentCustomer();

  if (!customer) {
    return (
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
        <h1 className="font-display text-2xl font-semibold italic tracking-tight">
          Inquiries
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

  const inquiries = await getInquiries(customer);

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
      <InquiryList inquiries={inquiries} />
    </main>
  );
}
