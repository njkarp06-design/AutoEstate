"use client";

import { useActionState } from "react";
import {
  updateOperatorTelegramChatIdAction,
  type SettingsFormState,
} from "./actions";

// Lives here, not in actions.ts: a "use server" module can only export async
// functions, so a const there fails the build (caught by `next build`, not by
// tsc or eslint).
const IDLE_SETTINGS_STATE: SettingsFormState = { status: "idle", message: "" };

/**
 * Wraps the chat-id field so a rejected or saved value actually says so.
 * A plain <form action={...}> can't surface the action's result; useActionState
 * consumes the return value that comes back in the same response as the
 * re-rendered route.
 */
export function TelegramChatIdForm({ defaultValue }: { defaultValue: string }) {
  const [state, formAction, isPending] = useActionState(
    updateOperatorTelegramChatIdAction,
    IDLE_SETTINGS_STATE,
  );

  return (
    <form action={formAction} className="mt-5">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1.5 font-mono text-xs uppercase tracking-wide text-status-muted">
          Telegram chat ID
          <input
            type="text"
            name="operatorTelegramChatId"
            defaultValue={defaultValue}
            inputMode="numeric"
            disabled={isPending}
            placeholder="e.g. 123456789"
            className="border-b border-line-strong bg-transparent pb-1 font-sans text-sm normal-case tracking-normal text-foreground placeholder:text-status-muted focus:outline-none disabled:opacity-50"
          />
        </label>
        <button
          type="submit"
          disabled={isPending}
          className="border-b border-line-strong font-mono text-xs uppercase tracking-wide disabled:opacity-50"
        >
          {isPending ? "Saving…" : "Save"}
        </button>
      </div>
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
