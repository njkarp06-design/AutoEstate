"use client";

import { useState } from "react";
import Link from "next/link";
import type { Run } from "@/lib/db";
import { formatRelativeDateTime, sourceLabel, sourceDotClass } from "@/lib/format";

type SourceFilter = "all" | "whatsapp" | "telegram";
type StatusFilter = "all" | "completed" | "in_progress";

export function RunList({ runs }: { runs: Run[] }) {
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const filtered = runs.filter((run) => {
    if (sourceFilter !== "all" && run.source !== sourceFilter) return false;
    if (statusFilter !== "all" && run.status !== statusFilter) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const title = (run.title ?? "").toLowerCase();
      if (!title.includes(q)) return false;
    }
    return true;
  });

  const completedCount = runs.filter((r) => r.status === "completed").length;

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <h1 className="font-display text-xl font-bold tracking-tight">
          Recent activity
        </h1>
        {runs.length > 0 && (
          <p className="text-sm text-gray-500">
            {completedCount} of {runs.length} listing
            {runs.length === 1 ? "" : "s"} ready
          </p>
        )}
      </div>
      <p className="mt-1 text-sm text-gray-500">
        Every listing sent to the agent, and the content it generated.
      </p>

      {runs.length > 0 && (
        <div className="mt-6 flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title…"
            className="min-w-0 flex-1 rounded-md border border-card-border bg-card px-3 py-1.5 text-sm"
          />
          <FilterChip
            label="Source"
            value={sourceFilter}
            options={[
              { value: "all", label: "All" },
              { value: "whatsapp", label: "WhatsApp" },
              { value: "telegram", label: "Telegram" },
            ]}
            onChange={(v) => setSourceFilter(v as SourceFilter)}
          />
          <FilterChip
            label="Status"
            value={statusFilter}
            options={[
              { value: "all", label: "All" },
              { value: "completed", label: "Ready" },
              { value: "in_progress", label: "In progress" },
            ]}
            onChange={(v) => setStatusFilter(v as StatusFilter)}
          />
        </div>
      )}

      {runs.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-card-border bg-card px-6 py-12 text-center">
          <p className="font-medium">No activity yet</p>
          <p className="mt-1 text-sm text-gray-500">
            Send the agent a listing over WhatsApp or Telegram and it will show up here.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-card-border bg-card px-6 py-12 text-center">
          <p className="font-medium">No listings match</p>
          <p className="mt-1 text-sm text-gray-500">
            Try a different search or filter.
          </p>
        </div>
      ) : (
        <ul className="mt-6 divide-y divide-card-border rounded-xl border border-card-border bg-card">
          {filtered.map((run) => (
            <li key={run.id}>
              <Link
                href={`/runs/${run.id}`}
                className="flex items-center justify-between gap-4 border-l-2 border-transparent p-4 transition hover:border-brand hover:bg-background"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {run.title ?? "Untitled listing"}
                  </p>
                  <p className="mt-1 flex items-center gap-1.5 text-sm text-gray-500">
                    <span
                      className={`inline-block h-1.5 w-1.5 rounded-full ${sourceDotClass(run.source)}`}
                    />
                    {sourceLabel(run.source)}
                    {run.displayName ? ` · ${run.displayName}` : ""}
                    {" · "}
                    {formatRelativeDateTime(run.startedAt)}
                  </p>
                </div>
                <span
                  className={
                    "flex shrink-0 items-center gap-1.5 rounded-sm border px-2.5 py-1 font-mono text-xs uppercase tracking-wide " +
                    (run.status === "completed"
                      ? "border-status-done text-status-done"
                      : "border-status-pending text-status-pending")
                  }
                >
                  {run.status === "in_progress" && (
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-status-pending" />
                  )}
                  {run.status === "completed" ? "Ready to post" : "In progress"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FilterChip<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <label className="flex items-center gap-1.5 text-sm text-gray-500">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="rounded-md border border-card-border bg-card px-2 py-1.5 text-sm text-foreground"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}
