// Shared presentational tile used by both the Activity list (run-list.tsx)
// and the Listings list (listing-list.tsx) stat strips - same convention as
// markdown-components.tsx for a shared, reusable piece of JSX living in lib/.
export function StatTile({
  label,
  value,
  caption,
  tone,
}: {
  label: string;
  value: string | number;
  caption?: string;
  tone?: "done" | "pending";
}) {
  return (
    <div className="flex flex-col gap-1 px-5 py-4">
      <span className="font-mono text-xs uppercase tracking-wide text-status-muted">
        {label}
      </span>
      <span
        className={
          "font-display text-3xl font-semibold tracking-tight " +
          (tone === "done"
            ? "text-status-done"
            : tone === "pending"
              ? "text-status-pending"
              : "text-foreground")
        }
      >
        {value}
      </span>
      {caption && (
        <span className="font-mono text-[0.65rem] uppercase tracking-wide text-status-muted">
          {caption}
        </span>
      )}
    </div>
  );
}
