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

type StatusFilter = "all" | ListingStatus;

function statusToneClasses(status: ListingStatus): string {
  if (status === "active") return "border-status-done text-status-done";
  if (status === "under_contract") return "border-status-pending text-status-pending";
  return "border-status-muted text-status-muted";
}

export function ListingList({ listings }: { listings: Listing[] }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const filtered = listings.filter((listing) => {
    if (statusFilter !== "all" && listing.status !== statusFilter) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      if (!listing.area.toLowerCase().includes(q)) return false;
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
              placeholder="Area…"
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
                    {listing.rooms}-room {transactionTypeLabel(listing.transactionType).toLowerCase()} in {listing.area}
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

            return (
              <li key={listing.id} className="border-b border-card-border">
                {listing.latestRunId ? (
                  <Link
                    href={`/runs/${listing.latestRunId}`}
                    className="flex items-center justify-between gap-4 py-4 transition hover:bg-card"
                  >
                    {rowContent}
                  </Link>
                ) : (
                  <div className="flex items-center justify-between gap-4 py-4">
                    {rowContent}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
