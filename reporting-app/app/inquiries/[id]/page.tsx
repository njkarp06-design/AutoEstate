import Link from "next/link";
import { notFound } from "next/navigation";
import { getInquiry } from "@/lib/inquiries";
import { getCurrentCustomer } from "@/lib/customer";
import {
  formatRelativeDateTime,
  formatPrice,
  sourceLabel,
  statusLabel,
  transactionTypeLabel,
} from "@/lib/format";
import { setInquiryHandledAction } from "./actions";

// Always read the live database - never serve a stale build-time snapshot.
export const dynamic = "force-dynamic";

export default async function InquiryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const customer = await getCurrentCustomer();

  if (!customer) {
    return (
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
        <Link href="/inquiries" className="font-mono text-xs uppercase tracking-wide text-status-muted hover:text-foreground">
          ← All inquiries
        </Link>
        <div className="mt-8 border border-dashed border-card-border px-6 py-12 text-center">
          <p className="font-display italic">Your account isn&apos;t linked yet</p>
          <p className="mt-1 text-sm text-status-muted">
            Contact your AutoEstate operator to get your account set up.
          </p>
        </div>
      </main>
    );
  }

  const inquiry = await getInquiry(id, customer);
  if (!inquiry) {
    notFound();
  }

  const listingStatusForDisplay =
    inquiry.listing?.status === "UNDER_CONTRACT"
      ? "under_contract"
      : inquiry.listing?.status === "SOLD"
        ? "sold"
        : "active";

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
      <Link href="/inquiries" className="font-mono text-xs uppercase tracking-wide text-status-muted hover:text-foreground">
        ← All inquiries
      </Link>

      <div className="mt-5 border border-card-border bg-card p-5">
        <div className="flex items-start justify-between gap-4">
          <h1 className="font-display text-lg font-semibold" dir="auto">
            {inquiry.title ?? "Buyer inquiry"}
          </h1>
          <div className="flex shrink-0 items-center gap-2">
            {inquiry.disposition === "needs_you" && inquiry.status !== "handled" && (
              <span className="flex items-center gap-1.5 border border-status-pending px-2.5 py-1 font-mono text-xs uppercase tracking-wide text-status-pending">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-status-pending" />
                Needs you
              </span>
            )}
            {inquiry.status === "handled" && (
              <span className="flex items-center border border-status-done px-2.5 py-1 font-mono text-xs uppercase tracking-wide text-status-done">
                Handled
              </span>
            )}
          </div>
        </div>
        <p className="mt-3 border-t border-card-border pt-3 font-mono text-xs uppercase tracking-wide text-status-muted">
          {sourceLabel(inquiry.source)}
          {" · "}
          {formatRelativeDateTime(inquiry.startedAt)}
        </p>

        {/* Buyer contact — the #1 lead field. */}
        <div className="mt-4">
          <p className="font-mono text-[0.65rem] uppercase tracking-widest text-status-muted">
            Buyer contact
          </p>
          {inquiry.buyerContact ? (
            <p className="mt-1 font-display text-base font-semibold" dir="auto">
              {inquiry.buyerContact}
            </p>
          ) : (
            <p className="mt-1 text-sm italic text-status-muted">
              Not captured — reply in the chat thread to reach this buyer.
            </p>
          )}
        </div>

        <form action={setInquiryHandledAction.bind(null, inquiry.id, inquiry.status !== "handled")} className="mt-5">
          <button
            type="submit"
            className="border border-line-strong px-4 py-2 font-mono text-xs uppercase tracking-wide transition hover:bg-background"
          >
            {inquiry.status === "handled" ? "Reopen lead" : "Mark handled"}
          </button>
        </form>
      </div>

      {inquiry.listing && (
        <div className="mt-6 border border-card-border p-5">
          <p className="font-mono text-[0.65rem] uppercase tracking-widest text-status-muted">
            About this listing
          </p>
          <Link
            href="/listings"
            className="mt-1 inline-block font-display text-base font-semibold hover:underline"
          >
            {inquiry.listing.rooms}-room{" "}
            {transactionTypeLabel(inquiry.listing.transactionType).toLowerCase() || "listing"}{" "}
            in {inquiry.listing.area}
          </Link>
          <p className="mt-1 font-mono text-xs uppercase tracking-wide text-status-muted">
            {inquiry.listing.sqm} sqm
            {inquiry.listing.floor !== null ? ` · Floor ${inquiry.listing.floor}` : ""}
            {" · "}
            {formatPrice(inquiry.listing.price)}
            {" · "}
            {statusLabel(listingStatusForDisplay)}
          </p>
        </div>
      )}

      <div className="mt-8">
        <p className="mb-3 font-mono text-xs uppercase tracking-wide text-status-muted">
          Conversation
        </p>
        <div className="space-y-3">
          {inquiry.messages.map((m, i) => {
            const isBuyer = m.role === "user";
            return (
              <div
                key={i}
                className={
                  "flex " + (isBuyer ? "justify-start" : "justify-end")
                }
              >
                <div
                  className={
                    "max-w-[85%] border p-3 " +
                    (isBuyer
                      ? "border-card-border bg-card"
                      : "border-line-strong bg-background")
                  }
                >
                  <p className="mb-1 font-mono text-[0.6rem] uppercase tracking-widest text-status-muted">
                    {isBuyer ? "Buyer" : "Agent"}
                    {" · "}
                    {formatRelativeDateTime(m.timestamp)}
                  </p>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed" dir="auto">
                    {m.content}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
