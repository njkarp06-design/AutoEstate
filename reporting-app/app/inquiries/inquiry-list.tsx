"use client";

import { useState } from "react";
import Link from "next/link";
import type { Inquiry, InquiryStatus } from "@/lib/inquiries";
import { formatRelativeDateTime, sourceLabel } from "@/lib/format";
import { StatTile } from "@/lib/stat-tile";

type StatusFilter = "all" | InquiryStatus;

export function InquiryList({ inquiries }: { inquiries: Inquiry[] }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const filtered = inquiries.filter((inq) => {
    if (statusFilter !== "all" && inq.status !== statusFilter) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const haystack = `${inq.title ?? ""} ${inq.buyerContact ?? ""}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  const needsYouCount = inquiries.filter((i) => i.disposition === "needs_you").length;
  const autoAnsweredCount = inquiries.length - needsYouCount;
  const whatsappCount = inquiries.filter((i) => i.source === "whatsapp").length;
  const telegramCount = inquiries.filter((i) => i.source === "telegram").length;

  return (
    <div>
      {inquiries.length > 0 && (
        <p className="font-mono text-xs uppercase tracking-widest text-brand">
          Leads · {needsYouCount} need you
        </p>
      )}
      <h1 className="mt-1.5 font-display text-2xl font-semibold italic tracking-tight text-balance">
        Buyer inquiries
      </h1>
      <p className="mt-1.5 text-sm text-status-muted">
        Questions buyers asked the agent, answered automatically — and the leads that need you.
      </p>

      {inquiries.length > 0 && (
        <div className="mt-7 grid grid-cols-2 divide-x divide-card-border border border-card-border bg-card sm:grid-cols-4">
          <StatTile label="Total inquiries" value={inquiries.length} />
          <StatTile label="Auto-answered" value={autoAnsweredCount} tone="done" />
          <StatTile label="Need you" value={needsYouCount} tone="pending" />
          <StatTile
            label="By channel"
            value={`${whatsappCount} / ${telegramCount}`}
            caption="WhatsApp / Telegram"
          />
        </div>
      )}

      {inquiries.length > 0 && (
        <div className="mt-7 flex flex-wrap gap-6 border-b border-card-border pb-5 font-mono text-xs uppercase tracking-wide">
          <label className="flex flex-1 min-w-[10rem] flex-col gap-1.5 text-status-muted">
            Search
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Question or contact…"
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
              <option value="needs_operator">Needs operator</option>
              <option value="handled">Handled</option>
            </select>
          </label>
        </div>
      )}

      {inquiries.length === 0 ? (
        <div className="mt-8 border border-dashed border-card-border px-6 py-12 text-center">
          <p className="font-display italic">No inquiries yet</p>
          <p className="mt-1 text-sm text-status-muted">
            When a buyer messages your listing number, their questions and the agent&apos;s
            replies will show up here.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="mt-8 border border-dashed border-card-border px-6 py-12 text-center">
          <p className="font-display italic">No inquiries match</p>
          <p className="mt-1 text-sm text-status-muted">
            Try a different search or filter.
          </p>
        </div>
      ) : (
        <ul>
          {filtered.map((inq) => (
            <li key={inq.id} className="border-b border-card-border">
              <Link
                href={`/inquiries/${inq.id}`}
                className="flex items-center justify-between gap-4 py-4 transition hover:bg-card"
              >
                <div className="min-w-0">
                  <p className="truncate font-display text-[1.05rem] font-semibold" dir="auto">
                    {inq.title ?? "Buyer inquiry"}
                  </p>
                  <p className="mt-1 font-mono text-xs uppercase tracking-wide text-status-muted">
                    {sourceLabel(inq.source)}
                    {" · "}
                    {inq.buyerContact ?? "Contact not captured"}
                    {" · "}
                    {formatRelativeDateTime(inq.startedAt)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {inq.disposition === "needs_you" && (
                    <span className="flex items-center border border-status-pending px-2.5 py-1 font-mono text-xs uppercase tracking-wide text-status-pending">
                      Needs you
                    </span>
                  )}
                  {inq.status === "handled" && (
                    <span className="flex items-center border border-status-done px-2.5 py-1 font-mono text-xs uppercase tracking-wide text-status-done">
                      Handled
                    </span>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
