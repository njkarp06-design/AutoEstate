"use client";

import { useActionState } from "react";
import {
  updateInstagramPostModeAction,
  type SettingsFormState,
} from "./actions";
import { INSTAGRAM_POST_MODES, type InstagramPostMode } from "@/lib/customer";

// Same reason as telegram-chat-id-form.tsx: a "use server" module can only
// export async functions, so this constant can't live in actions.ts.
const IDLE_SETTINGS_STATE: SettingsFormState = { status: "idle", message: "" };

// Labels are UI copy, so they live in the client component - but keyed as an
// exhaustive Record over the ONE shared mode union, so adding or renaming a
// mode in lib/customer.ts is a type error here instead of a silently
// mismatched radio. The values list itself renders from INSTAGRAM_POST_MODES;
// this map only decorates it.
const MODE_COPY: Record<InstagramPostMode, { label: string; description: string }> = {
  MANUAL: {
    label: "Manual",
    description: "Hermes drafts the caption; you copy and post it yourself.",
  },
  AUTO_AFTER_EDIT: {
    label: "Auto-post after I edit (coming soon)",
    description:
      "You review and edit the caption here, then it posts to Instagram automatically. Requires connecting Instagram - not available yet.",
  },
  AUTO_IMMEDIATE: {
    label: "Auto-post immediately (coming soon)",
    description:
      "Hermes posts to Instagram as soon as content is generated, no review step. Requires connecting Instagram - not available yet.",
  },
};

// Display order - MANUAL first (the live option), then the two inert ones.
const DISPLAY_ORDER: readonly InstagramPostMode[] = [
  "MANUAL",
  "AUTO_AFTER_EDIT",
  "AUTO_IMMEDIATE",
];

/**
 * Wraps the Instagram posting-mode radios so a save actually says so - the
 * same useActionState pattern as its two sibling forms, which it previously
 * lacked: a plain <form action={...}> surfaced nothing, so Save looked
 * identical whether it saved or silently discarded.
 */
export function InstagramModeForm({ defaultValue }: { defaultValue: InstagramPostMode }) {
  const [state, formAction, isPending] = useActionState(
    updateInstagramPostModeAction,
    IDLE_SETTINGS_STATE,
  );

  // Belt-and-braces: DISPLAY_ORDER is typed over the same union, so it cannot
  // name an unknown mode; filtering against the canonical list keeps the two
  // in step if a mode is ever removed.
  const modes = DISPLAY_ORDER.filter((m) => INSTAGRAM_POST_MODES.includes(m));

  return (
    <form action={formAction} className="mt-5">
      {modes.map((mode) => (
        <label
          key={mode}
          className="flex cursor-pointer items-start gap-3 border-t border-card-border py-4 first:border-t-0"
        >
          <input
            type="radio"
            name="instagramPostMode"
            value={mode}
            defaultChecked={defaultValue === mode}
            disabled={isPending}
            className="mt-1.5 accent-brand"
          />
          <span>
            <span className="block font-medium">{MODE_COPY[mode].label}</span>
            <span className="mt-0.5 block text-sm text-status-muted">
              {MODE_COPY[mode].description}
            </span>
          </span>
        </label>
      ))}
      <button
        type="submit"
        disabled={isPending}
        className="mt-4 border-b border-line-strong font-mono text-xs uppercase tracking-wide disabled:opacity-50"
      >
        {isPending ? "Saving…" : "Save"}
      </button>
      {state.status !== "idle" && (
        <p
          className={
            "mt-2 text-sm " +
            (state.status === "error" ? "text-secondary" : "text-status-done")
          }
        >
          {state.message}
        </p>
      )}
    </form>
  );
}
