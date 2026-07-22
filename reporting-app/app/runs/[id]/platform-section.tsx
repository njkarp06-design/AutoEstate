"use client";

import { useState, useTransition } from "react";
import ReactMarkdown from "react-markdown";
import { markdownComponents } from "@/lib/markdown-components";
import { formatRelativeDateTime } from "@/lib/format";
import { platformDisplayName, type PlatformKey } from "@/lib/platform-content";
import type { InstagramPostMode } from "@/lib/customer";

const POST_MODE_LABELS: Record<InstagramPostMode, string> = {
  MANUAL: "Manual",
  AUTO_IMMEDIATE: "Auto-post immediately (coming soon)",
  AUTO_AFTER_EDIT: "Auto-post after edit (coming soon)",
};

type Props = {
  platform: PlatformKey;
  content: string;
  isEdited: boolean;
  posted: boolean;
  postedAt: number | null;
  instagramPostMode?: InstagramPostMode; // only passed for platform === "instagram"
  saveAction: (formData: FormData) => Promise<void>;
  resetAction: () => Promise<void>;
  setPostedAction: (posted: boolean) => Promise<void>;
};

export function PlatformSection({
  platform,
  content,
  isEdited,
  posted,
  postedAt,
  instagramPostMode,
  saveAction,
  resetAction,
  setPostedAction,
}: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isTogglingPosted, startPostedTransition] = useTransition();
  const [isSaving, startSaveTransition] = useTransition();
  const [isResetting, startResetTransition] = useTransition();

  function handleCopy() {
    navigator.clipboard.writeText(content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleTogglePosted() {
    startPostedTransition(async () => {
      await setPostedAction(!posted);
    });
  }

  function handleReset() {
    startResetTransition(async () => {
      await resetAction();
    });
  }

  function handleSaveSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    // Invoked directly (not via <form action>) so the transition only
    // resolves - and edit mode only closes - once the save actually
    // completes, avoiding a flash of stale content before revalidation.
    startSaveTransition(async () => {
      await saveAction(formData);
      setIsEditing(false);
    });
  }

  return (
    <div className="rounded-xl border border-card-border bg-card p-5">
      <div className="flex items-center justify-between gap-4">
        <h3 className="font-display text-sm font-bold uppercase tracking-wide">
          {platformDisplayName(platform)}
        </h3>
        <div className="flex items-center gap-2">
          {isEdited && (
            <span className="font-mono text-xs uppercase tracking-wide text-status-muted">
              Edited
            </span>
          )}
          <span
            className={
              "rounded-sm border px-2 py-0.5 font-mono text-xs uppercase tracking-wide " +
              (posted
                ? "border-status-done text-status-done"
                : "border-status-muted text-status-muted")
            }
          >
            {posted ? "Posted" : "Not posted"}
          </span>
        </div>
      </div>
      {posted && postedAt && (
        <p className="mt-1 font-mono text-xs text-status-muted">
          {formatRelativeDateTime(postedAt)}
        </p>
      )}

      {isEditing ? (
        <form onSubmit={handleSaveSubmit} className="mt-3">
          <textarea
            name="content"
            defaultValue={content}
            required
            minLength={1}
            rows={10}
            disabled={isSaving}
            className="w-full rounded-lg border border-card-border bg-background p-3 text-sm leading-relaxed disabled:opacity-50"
          />
          <div className="mt-2 flex gap-2">
            <button
              type="submit"
              disabled={isSaving}
              className="rounded-md bg-brand px-3 py-1.5 text-xs font-medium text-brand-foreground disabled:opacity-50"
            >
              {isSaving ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              disabled={isSaving}
              className="rounded-md border border-card-border px-3 py-1.5 text-xs font-medium disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="mt-3 text-sm leading-relaxed">
          <ReactMarkdown components={markdownComponents}>{content}</ReactMarkdown>
        </div>
      )}

      {!isEditing && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            onClick={handleCopy}
            className="rounded-md border border-card-border px-3 py-1.5 text-xs font-medium"
          >
            {copied ? "Copied" : "Copy"}
          </button>
          <button
            onClick={() => setIsEditing(true)}
            className="rounded-md border border-card-border px-3 py-1.5 text-xs font-medium"
          >
            Edit
          </button>
          {isEdited && (
            <button
              onClick={handleReset}
              disabled={isResetting}
              className="rounded-md border border-card-border px-3 py-1.5 text-xs font-medium disabled:opacity-50"
            >
              {isResetting ? "Resetting…" : "Reset to original"}
            </button>
          )}
          <button
            onClick={handleTogglePosted}
            disabled={isTogglingPosted}
            className="rounded-md border border-card-border px-3 py-1.5 text-xs font-medium disabled:opacity-50"
          >
            {posted ? "Mark not posted" : "Mark posted"}
          </button>
        </div>
      )}

      {posted && isEdited && (
        <p className="mt-2 text-xs text-status-muted">
          You&apos;ve marked this posted - edits here aren&apos;t reflected on the
          platform.
        </p>
      )}

      <div className="mt-4 border-t border-card-border pt-3">
        {platform === "instagram" ? (
          <p className="font-mono text-xs uppercase tracking-wide text-status-muted">
            Posting: {POST_MODE_LABELS[instagramPostMode ?? "MANUAL"]} ·{" "}
            <a href="/settings" className="underline">
              change
            </a>
          </p>
        ) : (
          <p className="text-xs text-status-muted">
            Manual only - {platform === "facebook" ? "Meta" : "Yad2"} doesn&apos;t
            allow automated posting{" "}
            {platform === "facebook" ? "to groups" : "at all"}.
          </p>
        )}
      </div>
    </div>
  );
}
