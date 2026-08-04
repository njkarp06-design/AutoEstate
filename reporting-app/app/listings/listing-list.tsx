"use client";

import { useState } from "react";
import Link from "next/link";
import type { Listing, ListingStatus } from "@/lib/listings";
import {
  formatPrice,
  formatRelativeDateTime,
  statusLabel,
  transactionTypeLabel,
} from "@/lib/format";
import { StatTile } from "@/lib/stat-tile";
import { CopyButton } from "@/lib/copy-button";
import { buildBuyerDeepLink, formatRefCode } from "@/lib/ref-code";

type StatusFilter = "all" | ListingStatus;

function statusToneClasses(status: ListingStatus): string {
  if (status === "active") return "border-status-done text-status-done";
  if (status === "under_contract") return "border-status-pending text-status-pending";
  return "border-status-muted text-status-muted";
}

export function ListingList({
  listings,
  buyerWhatsappNumber,
}: {
  listings: Listing[];
  buyerWhatsappNumber: string | null;
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const filtered = listings.filter((listing) => {
    if (statusFilter !== "all" && listing.status !== statusFilter) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      // Search the ref code as well as the area: an agent looking at an ad
      // has the code in front of them, not necessarily the street name.
      const haystack = `${listing.area} ${listing.refCode ?? ""}`.toLowerCase();
      // Try the query AS TYPED first, plus - only when the query is an
      // explicit code reference ("REF-K7M2P", "ref k7m2p") - the same query
      // with that prefix stripped, since codes are stored bare. The strip
      // REQUIRES a separator after "ref": stripping unconditionally turned
      // "refa" into the needle "a" (matching almost every row) and "ref"
      // alone into "" (matching all of them), while an area genuinely
      // starting with "Ref..." still works through the as-typed branch.
      const stripped = q.replace(/^ref[\s:_-]+/, "");
      const matches =
        haystack.includes(q) ||
        (stripped !== q && stripped !== "" && haystack.includes(stripped));
      if (!matches) return false;
    }
    return true;
  });

  const activeCount = listings.filter((l) => l.status === "active").length;
  const underContractCount = listings.filter((l) => l.status === "under_contract").length;
  const soldCount = listings.filter((l) => l.status === "sold").length;

  return (
    <div>
      {listings.length > 0 && (
        <p className="font-mono text-xs uppercase tracking-widest text-brand">
          Ledger · {activeCount} active
        </p>
      )}
      <h1 className="mt-1.5 font-display text-2xl font-semibold italic tracking-tight text-balance">
        Listings
      </h1>
      <p className="mt-1.5 text-sm text-status-muted">
        Every property tracked from the agent&apos;s replies, and its current status.
      </p>

      {listings.length > 0 && (
        <div className="mt-7 grid grid-cols-2 divide-x divide-card-border border border-card-border bg-card sm:grid-cols-4">
          <StatTile label="Total listings" value={listings.length} />
          <StatTile label="Active" value={activeCount} tone="done" />
          <StatTile label="Under contract" value={underContractCount} tone="pending" />
          <StatTile label="Sold" value={soldCount} />
        </div>
      )}

      {listings.length > 0 && (
        <div className="mt-7 flex flex-wrap gap-6 border-b border-card-border pb-5 font-mono text-xs uppercase tracking-wide">
          <label className="flex flex-1 min-w-[10rem] flex-col gap-1.5 text-status-muted">
            Search
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Area or ad code…"
              className="border-b border-line-strong bg-transparent pb-1 font-sans text-sm normal-case tracking-normal text-foreground placeholder:text-status-muted focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-status-muted">
            Status
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="border-b border-line-strong bg-transparent pb-1 font-sans text-sm normal-case tracking-normal text-foreground focus:outline-none"
            >
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="under_contract">Under contract</option>
              <option value="sold">Sold</option>
            </select>
          </label>
        </div>
      )}

      {listings.length === 0 ? (
        <div className="mt-8 border border-dashed border-card-border px-6 py-12 text-center">
          <p className="font-display italic">No listings yet</p>
          <p className="mt-1 text-sm text-status-muted">
            Send the agent a listing over WhatsApp or Telegram and it will show up here.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="mt-8 border border-dashed border-card-border px-6 py-12 text-center">
          <p className="font-display italic">No listings match</p>
          <p className="mt-1 text-sm text-status-muted">
            Try a different search or filter.
          </p>
        </div>
      ) : (
        <ul>
          {filtered.map((listing) => {
            const rowContent = (
              <>
                <div className="min-w-0">
                  <p className="truncate font-display text-[1.05rem] font-semibold">
                    {/* || "listing": same fallback as the inquiry detail page -
                        an empty/unrecognized stored type otherwise renders
                        "3-room  in Haifa" with a double space. */}
                    {listing.rooms}-room {transactionTypeLabel(listing.transactionType).toLowerCase() || "listing"} in {listing.area}
                  </p>
                  <p className="mt-1 font-mono text-xs uppercase tracking-wide text-status-muted">
                    {listing.sqm} sqm
                    {listing.floor !== null ? ` · Floor ${listing.floor}` : ""}
                    {" · "}
                    {formatPrice(listing.price)}
                    {" · Updated "}
                    {formatRelativeDateTime(listing.updatedAt)}
                  </p>
                  {listing.features ? (
                    <p className="mt-1.5 truncate text-sm text-status-muted">
                      <span className="font-mono text-xs uppercase tracking-wide">
                        Features ·{" "}
                      </span>
                      {listing.features}
                    </p>
                  ) : null}
                </div>
                <span
                  className={
                    "flex shrink-0 items-center border px-2.5 py-1 font-mono text-xs uppercase tracking-wide " +
                    statusToneClasses(listing.status)
                  }
                >
                  {statusLabel(listing.status)}
                </span>
              </>
            );

            // Deliberately rendered OUTSIDE the <Link> below: a button nested
            // inside an anchor is invalid markup, and a click on it would
            // navigate to the run instead of copying.
            const deepLink = listing.refCode
              ? buildBuyerDeepLink(listing.refCode, buyerWhatsappNumber)
              : null;

            return (
              <li key={listing.id} className="border-b border-card-border">
                {listing.latestRunId ? (
                  <Link
                    href={`/runs/${listing.latestRunId}`}
                    className="flex items-center justify-between gap-4 pt-4 transition hover:bg-card"
                  >
                    {rowContent}
                  </Link>
                ) : (
                  <div className="flex items-center justify-between gap-4 pt-4">
                    {rowContent}
                  </div>
                )}

                {listing.refCode ? (
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pb-4 pt-2 font-mono text-xs uppercase tracking-wide text-status-muted">
                    <span>
                      Ad code ·{" "}
                      <span className="text-foreground">
                        {formatRefCode(listing.refCode)}
                      </span>
                    </span>
                    {deepLink ? (
                      <CopyButton value={deepLink} label="Copy ad link" />
                    ) : (
                      <Link href="/settings" className="border-b border-line-strong">
                        Add your buyer number to get a link
                      </Link>
                    )}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
