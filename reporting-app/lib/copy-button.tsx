"use client";

import { useState } from "react";

/**
 * Copy-to-clipboard with honest failure reporting.
 *
 * The failure handling is not decoration. The Clipboard API rejects on a
 * denied permission or a non-secure context, and an uncaught rejection leaves
 * a button that silently does nothing - which reads to the user as a broken
 * page. It also clears the failed state on a later success, because a label
 * that checks "failed" first will otherwise read "Copy failed" forever after
 * one denied attempt, including on every subsequent successful copy.
 */
export function CopyButton({
  value,
  label = "Copy",
  className = "",
}: {
  value: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(value).then(
      () => {
        setFailed(false);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      },
      () => setFailed(true),
    );
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={
        "shrink-0 border-b border-line-strong font-mono text-xs uppercase tracking-wide transition hover:text-foreground " +
        className
      }
    >
      {failed ? "Copy failed" : copied ? "Copied" : label}
    </button>
  );
}
