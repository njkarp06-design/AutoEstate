"use server";

import { revalidatePath } from "next/cache";
import { getCurrentCustomer, updateInstagramPostMode, type InstagramPostMode } from "@/lib/customer";

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
