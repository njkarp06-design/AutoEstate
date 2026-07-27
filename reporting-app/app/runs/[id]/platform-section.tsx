"use client";

import { useState, useTransition } from "react";
import ReactMarkdown from "react-markdown";
import { markdownComponents } from "@/lib/markdown-components";
import { formatRelativeDateTime } from "@/lib/format";
import { platformDisplayName, splitByLanguage, type PlatformKey } from "@/lib/platform-content";
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
  const [copyFailed, setCopyFailed] = useState(false);
  const [isTogglingPosted, startPostedTransition] = useTransition();
  const [isSaving, startSaveTransition] = useTransition();
  const [isResetting, startResetTransition] = useTransition();

  const languageSplit = splitByLanguage(content);

  function handleCopy() {
    // Caught: the Clipboard API rejects on a denied permission or a
    // non-secure context, which without this is an unhandled rejection and a
    // button that appears to do nothing at all.
    navigator.clipboard.writeText(content).then(
      () => {
        // Clear the failure too: the label checks copyFailed first, so without
        // this a single denied copy left the button reading "Copy failed"
        // forever, including after every subsequent successful copy.
        setCopyFailed(false);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      },
      () => setCopyFailed(true),
    );
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
    <div>
      <div className="flex items-baseline justify-between gap-4">
        <h3 className="font-display text-lg font-semibold italic">
          {platformDisplayName(platform)}
        </h3>
        <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-wide">
          {isEdited && <span className="text-status-muted">Edited</span>}
          <span className={posted ? "text-status-done" : "text-status-muted"}>
            {posted ? "Posted" : "Not posted"}
          </span>
        </div>
      </div>
      {posted && postedAt && (
        <p className="mt-0.5 font-mono text-xs text-status-muted">
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
            className="w-full border border-card-border bg-card p-3 text-sm leading-relaxed disabled:opacity-50"
          />
          <div className="mt-2 flex gap-4 font-mono text-xs uppercase tracking-wide">
            <button
              type="submit"
              disabled={isSaving}
              className="border-b border-line-strong disabled:opacity-50"
            >
              {isSaving ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              disabled={isSaving}
              className="border-b border-line-strong disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : languageSplit.matched ? (
        <div className="mt-3 grid grid-cols-[1fr_1px_1fr] gap-4 border border-card-border p-4">
          <div className="text-sm leading-relaxed">
            <ReactMarkdown components={markdownComponents}>
              {languageSplit.english}
            </ReactMarkdown>
          </div>
          <div className="bg-card-border" />
          <div dir="rtl" className="text-right text-sm leading-relaxed">
            <ReactMarkdown components={markdownComponents}>
              {languageSplit.hebrew}
            </ReactMarkdown>
          </div>
        </div>
      ) : (
        <div className="mt-3 border border-card-border p-4 text-sm leading-relaxed">
          <ReactMarkdown components={markdownComponents}>{content}</ReactMarkdown>
        </div>
      )}

      {!isEditing && (
        <div className="mt-3 flex flex-wrap items-center gap-4 border-t border-card-border pt-3 font-mono text-xs uppercase tracking-wide">
          <button onClick={handleCopy} className="border-b border-line-strong">
            {copyFailed ? "Copy failed — select manually" : copied ? "Copied" : "Copy"}
          </button>
          <button onClick={() => setIsEditing(true)} className="border-b border-line-strong">
            Edit
          </button>
          {isEdited && (
            <button
              onClick={handleReset}
              disabled={isResetting}
              className="border-b border-line-strong disabled:opacity-50"
            >
              {isResetting ? "Resetting…" : "Reset to original"}
            </button>
          )}
          <button
            onClick={handleTogglePosted}
            disabled={isTogglingPosted}
            className="border-b border-line-strong disabled:opacity-50"
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

      <div className="mt-3">
        {platform === "instagram" ? (
          <p className="font-mono text-xs uppercase tracking-wide text-status-muted">
            Posting: {POST_MODE_LABELS[instagramPostMode ?? "MANUAL"]} ·{" "}
            <a href="/settings" className="underline">
              change
            </a>
          </p>
        ) : (
          <p className="font-mono text-xs uppercase tracking-wide text-status-muted">
            {`Manual only - ${platform === "facebook" ? "Meta" : "Yad2"} doesn't allow automated posting ${platform === "facebook" ? "to groups" : "at all"}.`}
          </p>
        )}
      </div>
    </div>
  );
}
