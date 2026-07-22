import Link from "next/link";
import { getRuns } from "@/lib/db";
import { getCurrentCustomer } from "@/lib/customer";
import { formatRelativeDateTime, platformDotClass, platformLabel } from "@/lib/format";

// Always read the live database - this dashboard must never serve a stale
// build-time snapshot of agent activity.
export const dynamic = "force-dynamic";

export default async function Home() {
  const customer = await getCurrentCustomer();

  if (!customer) {
    return (
      <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-10">
        <h1 className="text-xl font-semibold">Recent activity</h1>
        <div className="mt-8 rounded-xl border border-dashed border-card-border bg-card px-6 py-12 text-center">
          <p className="font-medium">Your account isn&apos;t linked yet</p>
          <p className="mt-1 text-sm text-gray-500">
            Contact your AutoEstate operator to get your account set up.
          </p>
        </div>
      </main>
    );
  }

  const runs = await getRuns(customer);
  const completedCount = runs.filter((r) => r.status === "completed").length;

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-10">
      <div className="flex items-baseline justify-between">
        <h1 className="text-xl font-semibold">Recent activity</h1>
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

      {runs.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-card-border bg-card px-6 py-12 text-center">
          <p className="font-medium">No activity yet</p>
          <p className="mt-1 text-sm text-gray-500">
            Send the agent a listing over WhatsApp or Telegram and it will show up here.
          </p>
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {runs.map((run) => (
            <li key={run.id}>
              <Link
                href={`/runs/${run.id}`}
                className="flex items-center justify-between gap-4 rounded-xl border border-card-border bg-card p-4 shadow-sm transition hover:border-brand/40 hover:shadow-md"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {run.title ?? "Untitled listing"}
                  </p>
                  <p className="mt-1 flex items-center gap-1.5 text-sm text-gray-500">
                    <span
                      className={`inline-block h-1.5 w-1.5 rounded-full ${platformDotClass(run.source)}`}
                    />
                    {platformLabel(run.source)}
                    {run.displayName ? ` · ${run.displayName}` : ""}
                    {" · "}
                    {formatRelativeDateTime(run.startedAt)}
                  </p>
                </div>
                <span
                  className={
                    "flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium " +
                    (run.status === "completed"
                      ? "bg-green-100 text-green-800"
                      : "bg-amber-100 text-amber-800")
                  }
                >
                  {run.status === "in_progress" && (
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-600" />
                  )}
                  {run.status === "completed" ? "Ready to post" : "In progress"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
