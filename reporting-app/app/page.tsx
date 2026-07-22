import Link from "next/link";
import { getRuns } from "@/lib/db";

// Always read the live database - this dashboard must never serve a stale
// build-time snapshot of agent activity.
export const dynamic = "force-dynamic";

function formatDateTime(epochSeconds: number): string {
  return new Date(epochSeconds * 1000).toLocaleString("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function platformLabel(source: string): string {
  if (source === "whatsapp") return "WhatsApp";
  if (source === "telegram") return "Telegram";
  return source;
}

export default function Home() {
  const runs = getRuns();

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-10">
      <h1 className="text-2xl font-semibold">AutoEstate — Agent Activity</h1>
      <p className="mt-1 text-sm text-gray-500">
        Every listing the agent has turned into ready-to-post content.
      </p>

      {runs.length === 0 ? (
        <p className="mt-10 text-gray-500">No runs yet.</p>
      ) : (
        <ul className="mt-8 divide-y divide-gray-200 border-t border-b border-gray-200">
          {runs.map((run) => (
            <li key={run.id}>
              <Link
                href={`/runs/${run.id}`}
                className="flex items-center justify-between gap-4 py-4 hover:bg-gray-50"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {run.title ?? "Untitled listing"}
                  </p>
                  <p className="mt-0.5 text-sm text-gray-500">
                    {formatDateTime(run.startedAt)} · {platformLabel(run.source)}
                    {run.displayName ? ` · ${run.displayName}` : ""}
                  </p>
                </div>
                <span
                  className={
                    "shrink-0 rounded-full px-2.5 py-1 text-xs font-medium " +
                    (run.status === "completed"
                      ? "bg-green-100 text-green-800"
                      : "bg-amber-100 text-amber-800")
                  }
                >
                  {run.status === "completed" ? "Completed" : "In progress"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
