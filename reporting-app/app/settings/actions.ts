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

export async function updateOperatorTelegramChatIdAction(formData: FormData) {
  const customer = await getCurrentCustomer();
  if (!customer) return;

  // Empty clears it (dashboard-only, no push). A chat id is digits, optionally
  // negative for a group - reject anything else rather than store junk that
  // would silently fail every sendMessage.
  const raw = String(formData.get("operatorTelegramChatId") ?? "").trim();
  if (raw !== "" && !/^-?\d+$/.test(raw)) return;

  await updateOperatorTelegramChatId(customer, raw);
  revalidatePath("/settings");
}
