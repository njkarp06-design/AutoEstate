"use client";

import { useState } from "react";
import Link from "next/link";
import type { Run } from "@/lib/db";
import { formatRelativeDateTime, isWhatsAppSource, sourceLabel } from "@/lib/format";
import { StatTile } from "@/lib/stat-tile";

type SourceFilter = "all" | "whatsapp" | "telegram";
type StatusFilter = "all" | "completed" | "in_progress";

export function RunList({ runs }: { runs: Run[] }) {
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const filtered = runs.filter((run) => {
    if (sourceFilter === "whatsapp" && !isWhatsAppSource(run.source)) return false;
    if (sourceFilter === "telegram" && run.source !== "telegram") return false;
    if (statusFilter !== "all" && run.status !== statusFilter) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const title = (run.title ?? "").toLowerCase();
      if (!title.includes(q)) return false;
    }
    return true;
  });

  const completedCount = runs.filter((r) => r.status === "completed").length;
  const inProgressCount = runs.length - completedCount;
  const whatsappCount = runs.filter((r) => isWhatsAppSource(r.source)).length;
  const telegramCount = runs.filter((r) => r.source === "telegram").length;

  return (
    <div>
      {runs.length > 0 && (
        <p className="font-mono text-xs uppercase tracking-widest text-brand">
          Ledger · {completedCount} of {runs.length} ready
        </p>
      )}
      <h1 className="mt-1.5 font-display text-2xl font-semibold italic tracking-tight text-balance">
        Recent activity
      </h1>
      <p className="mt-1.5 text-sm text-status-muted">
        Every listing sent to the agent, and the content it generated.
      </p>

      {runs.length > 0 && (
        <div className="mt-7 grid grid-cols-2 divide-x divide-card-border border border-card-border bg-card sm:grid-cols-4">
          <StatTile label="Total listings" value={runs.length} />
          <StatTile label="Ready" value={completedCount} tone="done" />
          <StatTile label="In progress" value={inProgressCount} tone="pending" />
          <StatTile
            label="By channel"
            value={`${whatsappCount} / ${telegramCount}`}
            caption="WhatsApp / Telegram"
          />
        </div>
      )}

      {runs.length > 0 && (
        <div className="mt-7 flex flex-wrap gap-6 border-b border-card-border pb-5 font-mono text-xs uppercase tracking-wide">
          <label className="flex flex-1 min-w-[10rem] flex-col gap-1.5 text-status-muted">
            Search
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Title…"
              className="border-b border-line-strong bg-transparent pb-1 font-sans text-sm normal-case tracking-normal text-foreground placeholder:text-status-muted focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-status-muted">
            Source
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value as SourceFilter)}
              className="border-b border-line-strong bg-transparent pb-1 font-sans text-sm normal-case tracking-normal text-foreground focus:outline-none"
            >
              <option value="all">All</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="telegram">Telegram</option>
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-status-muted">
            Status
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="border-b border-line-strong bg-transparent pb-1 font-sans text-sm normal-case tracking-normal text-foreground focus:outline-none"
            >
              <option value="all">All</option>
              <option value="completed">Ready</option>
              <option value="in_progress">In progress</option>
            </select>
          </label>
        </div>
      )}

      {runs.length === 0 ? (
        <div className="mt-8 border border-dashed border-card-border px-6 py-12 text-center">
          <p className="font-display italic">No activity yet</p>
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
          {filtered.map((run) => (
            <li key={run.id} className="border-b border-card-border">
              <Link
                href={`/runs/${run.id}`}
                className="flex items-center justify-between gap-4 py-4 transition hover:bg-card"
              >
                <div className="min-w-0">
                  {/* dir="auto": in-progress/unsplit listings fall back to the
                      raw Hebrew title - same convention as the Inquiries list. */}
                  <p dir="auto" className="truncate font-display text-[1.05rem] font-semibold">
                    {run.title ?? "Untitled listing"}
                  </p>
                  <p className="mt-1 font-mono text-xs uppercase tracking-wide text-status-muted">
                    {sourceLabel(run.source)}
                    {" · "}
                    {formatRelativeDateTime(run.startedAt)}
                  </p>
                </div>
                <span
                  className={
                    "flex shrink-0 items-center gap-1.5 border px-2.5 py-1 font-mono text-xs uppercase tracking-wide " +
                    (run.status === "completed"
                      ? "border-status-done text-status-done"
                      : "border-status-pending text-status-pending")
                  }
                >
                  {run.status === "in_progress" && (
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-status-pending" />
                  )}
                  {run.status === "completed" ? "Ready" : "In progress"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
