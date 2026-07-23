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
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
        <Link href="/" className="font-mono text-xs uppercase tracking-wide text-status-muted hover:text-foreground">
          ← All activity
        </Link>
        <div className="mt-8 border border-dashed border-card-border px-6 py-12 text-center">
          <p className="font-display italic">Your account isn&apos;t linked yet</p>
          <p className="mt-1 text-sm text-status-muted">
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

  // A listing that needed a clarifying follow-up spans more than one
  // user/assistant pair (see lib/run-grouping.ts) - the LAST assistant
  // message is the one that actually generated the listing (or, if none
  // did yet, the agent's latest reply); everything before it is shown as a
  // short transcript so the viewer can see the whole exchange, including
  // any photo the agent sent.
  const assistantMessage = [...run.messages].reverse().find((m) => m.role === "assistant");
  const precursorMessages = assistantMessage
    ? run.messages.filter((m) => m !== assistantMessage)
    : run.messages;
  const parsed = assistantMessage ? splitPlatformContent(assistantMessage.content) : null;

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
      <Link href="/" className="font-mono text-xs uppercase tracking-wide text-status-muted hover:text-foreground">
        ← All activity
      </Link>

      <div className="mt-5 border border-card-border bg-card p-5">
        <div className="flex items-start justify-between gap-4">
          <h1 className="font-display text-lg font-semibold">
            {run.title ?? "Untitled listing"}
          </h1>
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
        </div>
        <p className="mt-3 border-t border-card-border pt-3 font-mono text-xs uppercase tracking-wide text-status-muted">
          {sourceLabel(run.source)}
          {run.displayName ? ` · ${run.displayName}` : ""}
          {" · "}
          {formatRelativeDateTime(run.startedAt)}
        </p>
      </div>

      {assistantMessage && parsed && (
        <div className="mt-8 space-y-6">
          {parsed.matched && parsed.multipleListingsDetected && (
            <p className="border-l-2 border-secondary py-1 pl-4 text-sm text-secondary">
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
            <div className="border border-card-border p-5">
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

      {precursorMessages.length > 0 && (
        <details className="mt-10 border-t border-card-border pt-3">
          <summary className="cursor-pointer font-mono text-xs uppercase tracking-wide text-status-muted">
            Original request
          </summary>
          <div className="mt-3 space-y-3 text-xs leading-relaxed text-status-muted">
            {precursorMessages.map((m, i) => (
              <p key={i} className="whitespace-pre-wrap">
                <span className="font-mono uppercase">
                  {m.role === "user" ? "You: " : "Agent: "}
                </span>
                {m.content}
              </p>
            ))}
          </div>
        </details>
      )}
    </main>
  );
}
