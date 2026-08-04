"use server";

import { revalidatePath } from "next/cache";
import {
  getCurrentCustomer,
  updateBuyerWhatsappNumber,
  updateInstagramPostMode,
  updateOperatorTelegramChatId,
} from "@/lib/customer";
import { INSTAGRAM_POST_MODES } from "@/lib/instagram-post-mode";
import { normalizeWhatsappNumber } from "@/lib/ref-code";

/**
 * Same result-returning shape as the two actions below, and late to it: this
 * was the app's one remaining silent-discard form - every failure branch
 * `return`ed void, so pressing Save looked identical whether it saved,
 * the account wasn't linked, or the value was rejected.
 */
export async function updateInstagramPostModeAction(
  _prevState: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  const customer = await getCurrentCustomer();
  if (!customer) {
    return { status: "error", message: "Your account isn't linked yet." };
  }

  const raw = String(formData.get("instagramPostMode") ?? "");
  const mode = INSTAGRAM_POST_MODES.find((m) => m === raw);
  if (!mode) {
    return { status: "error", message: "Pick one of the listed options." };
  }

  await updateInstagramPostMode(customer, mode);
  revalidatePath("/settings");
  return { status: "saved", message: "Saved." };
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

/**
 * The buyer-facing WhatsApp number, used only to build each listing's ad link.
 * Same result-returning shape as the chat id above and for the same reason: a
 * silently-discarded value here means every listing keeps showing "no link
 * yet" with nothing explaining why.
 */
export async function updateBuyerWhatsappNumberAction(
  _prevState: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  const customer = await getCurrentCustomer();
  if (!customer) {
    return { status: "error", message: "Your account isn't linked yet." };
  }

  const raw = String(formData.get("buyerWhatsappNumber") ?? "").trim();
  // Validate through the same normalizer that builds the links, so anything
  // accepted here is guaranteed to produce a working wa.me URL - a second,
  // looser rule in the UI layer is how you get a stored value that passes the
  // form and then silently fails to render a link.
  if (raw !== "" && normalizeWhatsappNumber(raw) === null) {
    return {
      status: "error",
      message:
        "Use the international form, e.g. +972 52 441 9087 - a local number starting with 0 makes a WhatsApp link that opens a chat with nobody.",
    };
  }

  await updateBuyerWhatsappNumber(customer, raw);
  revalidatePath("/settings");
  revalidatePath("/listings");
  return {
    status: "saved",
    message:
      raw === ""
        ? "Cleared - your listings will show their code without a link."
        : "Saved. Your listings now show a ready-to-paste ad link.",
  };
}
