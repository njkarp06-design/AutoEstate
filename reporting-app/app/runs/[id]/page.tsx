import Link from "next/link";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { getRun } from "@/lib/db";
import { formatRelativeDateTime, platformLabel } from "@/lib/format";

const markdownComponents = {
  h2: (props: React.ComponentPropsWithoutRef<"h2">) => (
    <h2
      className="mt-6 mb-2 border-t border-blue-100 pt-4 text-base font-semibold first:mt-0 first:border-t-0 first:pt-0"
      {...props}
    />
  ),
  ul: (props: React.ComponentPropsWithoutRef<"ul">) => (
    <ul className="my-2 list-disc space-y-1 pl-5" {...props} />
  ),
  strong: (props: React.ComponentPropsWithoutRef<"strong">) => (
    <strong className="font-semibold" {...props} />
  ),
  hr: () => null, // section breaks are handled by the h2 top border instead
  p: (props: React.ComponentPropsWithoutRef<"p">) => (
    <p className="mb-2 last:mb-0" {...props} />
  ),
};

// Always read the live database - never serve a stale build-time snapshot.
export const dynamic = "force-dynamic";

export default async function RunPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const run = await getRun(id);

  if (!run) {
    notFound();
  }

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
      <Link href="/" className="text-sm text-gray-500 hover:underline">
        ← All activity
      </Link>

      <div className="mt-4 flex items-start justify-between gap-4">
        <h1 className="text-xl font-semibold">
          {run.title ?? "Untitled listing"}
        </h1>
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
      </div>

      <p className="mt-1 text-sm text-gray-500">
        {formatRelativeDateTime(run.startedAt)} · {platformLabel(run.source)}
        {run.displayName ? ` · ${run.displayName}` : ""}
      </p>

      <div className="mt-8 space-y-4">
        {run.messages.map((message, i) => (
          <div
            key={i}
            className={
              "rounded-xl border p-5 " +
              (message.role === "user"
                ? "border-card-border bg-card"
                : "border-blue-100 bg-blue-50")
            }
          >
            <p className="mb-3 text-xs font-medium uppercase tracking-wide text-gray-500">
              {message.role === "user" ? "What you sent" : "Ready-to-post content"}
            </p>
            {message.role === "assistant" ? (
              <div className="text-sm leading-relaxed">
                <ReactMarkdown components={markdownComponents}>
                  {message.content}
                </ReactMarkdown>
              </div>
            ) : (
              <p className="whitespace-pre-wrap text-sm leading-relaxed">
                {message.content}
              </p>
            )}
          </div>
        ))}
      </div>
    </main>
  );
}
