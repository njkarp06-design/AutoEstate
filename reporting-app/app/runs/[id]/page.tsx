import Link from "next/link";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { getRun } from "@/lib/db";
import { getCurrentCustomer } from "@/lib/customer";
import { formatRelativeDateTime, sourceLabel } from "@/lib/format";
import { markdownComponents } from "@/lib/markdown-components";
import { splitPlatformContent, PLATFORM_KEYS } from "@/lib/platform-content";
import { PlatformSection } from "./platform-section";
import {
  savePlatformContentAction,
  resetPlatformContentAction,
  setPlatformPostedAction,
} from "./actions";

// Always read the live database - never serve a stale build-time snapshot.
export const dynamic = "force-dynamic";

export default async function RunPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const customer = await getCurrentCustomer();

  if (!customer) {
    return (
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
        <Link href="/" className="text-sm text-gray-500 hover:underline">
          ← All activity
        </Link>
        <div className="mt-8 rounded-xl border border-dashed border-card-border bg-card px-6 py-12 text-center">
          <p className="font-medium">Your account isn&apos;t linked yet</p>
          <p className="mt-1 text-sm text-gray-500">
            Contact your AutoEstate operator to get your account set up.
          </p>
        </div>
      </main>
    );
  }

  const run = await getRun(id, customer);

  if (!run) {
    notFound();
  }

  const userMessage = run.messages.find((m) => m.role === "user");
  const assistantMessage = run.messages.find((m) => m.role === "assistant");
  const parsed = assistantMessage ? splitPlatformContent(assistantMessage.content) : null;

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
      <Link href="/" className="text-sm text-gray-500 hover:underline">
        ← All activity
      </Link>

      <div className="mt-4 flex items-start justify-between gap-4">
        <h1 className="font-display text-xl font-bold tracking-tight">
          {run.title ?? "Untitled listing"}
        </h1>
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
      </div>

      <p className="mt-1 text-sm text-gray-500">
        {formatRelativeDateTime(run.startedAt)} · {sourceLabel(run.source)}
        {run.displayName ? ` · ${run.displayName}` : ""}
      </p>

      {userMessage && (
        <div className="mt-8 rounded-xl border border-card-border bg-card p-5">
          <p className="mb-3 font-mono text-xs uppercase tracking-wide text-status-muted">
            What you sent
          </p>
          <p className="whitespace-pre-wrap text-sm leading-relaxed">
            {userMessage.content}
          </p>
        </div>
      )}

      {assistantMessage && parsed && (
        <div className="mt-4 space-y-4">
          {parsed.matched && parsed.multipleListingsDetected && (
            <p className="rounded-md border border-status-pending bg-status-pending-bg px-3 py-2 text-xs text-status-pending">
              Hermes&apos;s reply included more than one listing (a rapid
              back-to-back message can merge into the same response) -
              showing the content for this listing; double-check it before
              posting.
            </p>
          )}
          {parsed.matched ? (
            PLATFORM_KEYS.map((platform) => {
              const status = run.platformStatus[platform];
              const displayContent = status.editedContent ?? parsed.sections[platform];
              const isEdited = status.editedContent != null;
              return (
                <PlatformSection
                  key={platform}
                  platform={platform}
                  content={displayContent}
                  isEdited={isEdited}
                  posted={status.posted}
                  postedAt={status.postedAt}
                  instagramPostMode={
                    platform === "instagram" ? customer.instagramPostMode : undefined
                  }
                  saveAction={savePlatformContentAction.bind(null, run.id, platform)}
                  resetAction={resetPlatformContentAction.bind(null, run.id, platform)}
                  setPostedAction={setPlatformPostedAction.bind(null, run.id, platform)}
                />
              );
            })
          ) : (
            <div className="rounded-xl border border-card-border bg-card p-5">
              <p className="mb-3 font-mono text-xs uppercase tracking-wide text-status-muted">
                Full response
              </p>
              <p className="mb-3 text-xs text-status-muted">
                Couldn&apos;t automatically split this into separate
                Instagram/Facebook/Yad2 sections, so showing the full response
                below instead.
              </p>
              <div className="text-sm leading-relaxed">
                <ReactMarkdown components={markdownComponents}>
                  {assistantMessage.content}
                </ReactMarkdown>
              </div>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
