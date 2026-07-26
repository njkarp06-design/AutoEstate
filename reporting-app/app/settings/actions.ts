"use server";

import { revalidatePath } from "next/cache";
import {
  getCurrentCustomer,
  updateInstagramPostMode,
  updateOperatorTelegramChatId,
  type InstagramPostMode,
} from "@/lib/customer";

const VALID_MODES: readonly InstagramPostMode[] = ["MANUAL", "AUTO_IMMEDIATE", "AUTO_AFTER_EDIT"];

export async function updateInstagramPostModeAction(formData: FormData) {
  const customer = await getCurrentCustomer();
  if (!customer) return;

  const raw = String(formData.get("instagramPostMode") ?? "");
  const mode = VALID_MODES.find((m) => m === raw);
  if (!mode) return; // reject anything outside the known 3 values

  await updateInstagramPostMode(customer, mode);
  revalidatePath("/settings");
}

// Deliberately small and serializable - action return values are sent to the
// client, so this carries only what the UI renders.
//
// Type only, no value: a "use server" module may export nothing but async
// functions, so the matching initial-state constant lives in the client
// component instead. Types are erased at compile time and are fine here.
export type SettingsFormState = { status: "idle" | "saved" | "error"; message: string };

/**
 * Returns a result rather than silently no-op'ing. A rejected chat id used to
 * just `return`, so the form re-rendered with the old value and the customer
 * had no way to tell a typo from a successful save - the one silent-discard
 * in the app with real user-visible consequences (no chat id means no lead
 * alerts, which is exactly the failure you'd never notice).
 */
export async function updateOperatorTelegramChatIdAction(
  _prevState: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  const customer = await getCurrentCustomer();
  if (!customer) {
    return { status: "error", message: "Your account isn't linked yet." };
  }

  // Empty clears it (dashboard-only, no push). A chat id is digits, optionally
  // negative for a group - reject anything else rather than store junk that
  // would silently fail every sendMessage.
  const raw = String(formData.get("operatorTelegramChatId") ?? "").trim();
  if (raw !== "" && !/^-?\d+$/.test(raw)) {
    return {
      status: "error",
      message: "That doesn't look like a Telegram chat ID - it should be digits only (e.g. 123456789).",
    };
  }

  await updateOperatorTelegramChatId(customer, raw);
  revalidatePath("/settings");
  return {
    status: "saved",
    message: raw === "" ? "Cleared - leads will show on the dashboard only." : "Saved.",
  };
}
