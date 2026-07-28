"use client";

import { useActionState } from "react";
import {
  updateBuyerWhatsappNumberAction,
  type SettingsFormState,
} from "./actions";

// Same reason as telegram-chat-id-form.tsx: a "use server" module can only
// export async functions, so this constant can't live in actions.ts.
const IDLE_SETTINGS_STATE: SettingsFormState = { status: "idle", message: "" };

export function BuyerNumberForm({ defaultValue }: { defaultValue: string }) {
  const [state, formAction, isPending] = useActionState(
    updateBuyerWhatsappNumberAction,
    IDLE_SETTINGS_STATE,
  );

  return (
    <form action={formAction} className="mt-5">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1.5 font-mono text-xs uppercase tracking-wide text-status-muted">
          Buyer WhatsApp number
          <input
            type="text"
            name="buyerWhatsappNumber"
            defaultValue={defaultValue}
            inputMode="tel"
            disabled={isPending}
            placeholder="e.g. +972 52 441 9087"
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
